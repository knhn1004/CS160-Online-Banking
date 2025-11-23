"use server";
import { redirect } from "next/navigation";
import { SignupSchema } from "@/lib/schemas/user";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";
import { z } from "zod";
import { runOnboardingTasks } from "./onboardAction";
import { USStateTerritory } from "@prisma/client";

const prisma = getPrisma();

export async function signupAction(formData: FormData) {
  const payload = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = SignupSchema.safeParse(payload);
  if (!parsed.success) {
    return redirect(`/signup?error=${encodeURIComponent("Validation failed")}`);
  }

  type SignupPayload = z.infer<typeof SignupSchema>;
  const p = parsed.data as SignupPayload;

  if (p.password !== p.confirmPassword) {
    return redirect(
      `/signup?error=${encodeURIComponent("Passwords do not match")}`,
    );
  }

  const normalizedEmail = String(p.email ?? "")
    .trim()
    .toLowerCase();
  const normalizePhone = (v?: string) => {
    if (!v) return null;
    const digits = String(v).replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1"))
      return `+1${digits.slice(-10)}`;
    return null;
  };
  const normalizedPhone = normalizePhone(p.phoneNumber ?? null);

  // Conflict check (keeps behavior consistent with your API route)
  const conflict = await prisma.user.findFirst({
    where: {
      OR: [
        { username: String(p.username ?? "") },
        { email: normalizedEmail },
        ...(normalizedPhone ? [{ phone_number: normalizedPhone }] : []),
      ],
    },
    select: { username: true, email: true, phone_number: true },
  });

  if (conflict) {
    if (conflict.username === p.username)
      return redirect(`/signup?error=${encodeURIComponent("Username taken")}`);
    if (conflict.email === normalizedEmail)
      return redirect(
        `/signup?error=${encodeURIComponent("Email already in use")}`,
      );
    if (normalizedPhone && conflict.phone_number === normalizedPhone)
      return redirect(
        `/signup?error=${encodeURIComponent("Phone number already in use")}`,
      );
    return redirect(`/signup?error=${encodeURIComponent("Conflict")}`);
  }

  // Use anon/server cookie-aware client for public signup (no service-role key required here)
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: String(p.password),
      options: { data: { profileDraft: { ...p, password: undefined } } },
    });

    console.debug("[signupAction] signUp result", { data, error });

    if (error) {
      if (/already.*exists/i.test(error.message ?? "")) {
        return redirect(
          `/signup?error=${encodeURIComponent("Auth user already exists")}`,
        );
      }
      console.error("[signupAction] signUp failed", {
        message: error.message,
        error,
      });
      return redirect(
        `/signup?error=${encodeURIComponent("Auth provider error")}`,
      );
    }

    // If signUp created a session (no email confirm required) -> onboard now.
    if (!data?.session?.user) {
      console.debug(
        "[signupAction] signUp did not return a session (email confirm likely required)",
        { data },
      );
      return redirect(
        "/login?next=" + encodeURIComponent("/dashboard?onboard=1"),
      );
    }

    const userId = data.session.user.id;
    console.debug(
      "[signupAction] session created; calling runOnboardingTasks",
      { userId },
    );
    try {
      await runOnboardingTasks(userId, {
        username: p.username,
        firstName: p.firstName ?? null,
        lastName: p.lastName ?? null,
        email: p.email ?? null,
        phoneNumber: p.phoneNumber ?? null,
        streetAddress: p.streetAddress ?? null,
        addressLine2: p.addressLine2 ?? null,
        city: p.city ?? null,
        stateOrTerritory: (p.stateOrTerritory ??
          null) as USStateTerritory | null,
        postalCode: p.postalCode ?? null,
      });
    } catch (onboardErr) {
      // Log full error server-side for diagnostics, but show a safe message in the redirect.
      console.error("[signupAction] onboarding failed", onboardErr);
      // Redirect user to the onboarding page so they can finish/ retry onboarding,
      // include a safe, generic message (don't leak internal error details).
      return redirect(
        `/dashboard?onboard_error=1&message=${encodeURIComponent("Failed to complete onboarding. Please try again.")}`,
      );
    }
    return redirect("/dashboard");
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null) {
      const maybe = err as Record<PropertyKey, unknown>;
      const digest = maybe["digest"];
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
    }

    console.error("[signupAction] unexpected", err);
    return redirect(`/signup?error=${encodeURIComponent("Unexpected error")}`);
  }
}

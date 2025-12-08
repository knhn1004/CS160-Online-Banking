"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";
import type { USStateTerritory } from "@prisma/client";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const prisma = getPrisma();

function isPrismaP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

/**
 * Creates a user row in the database (idempotent - handles concurrent creates).
 * Optionally updates Supabase auth metadata if service role key is available.
 */
export async function runOnboardingTasks(
  userId: string,
  p: {
    username: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    streetAddress?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateOrTerritory?: USStateTerritory | null;
    postalCode?: string | null;
  },
) {
  // Validate phone number format if provided (must be E.164: +1XXXXXXXXXX = 12 chars)
  if (p.phoneNumber && p.phoneNumber.length !== 12) {
    throw new Error(
      `Invalid phone number format: expected E.164 format (+1XXXXXXXXXX), got length ${p.phoneNumber.length}`,
    );
  }

  // Create user row (race-safe: P2002 duplicate key is treated as success)
  try {
    await prisma.user.create({
      data: {
        username: p.username,
        auth_user_id: userId,
        first_name: p.firstName ?? "",
        last_name: p.lastName ?? "",
        email: p.email ?? "",
        phone_number: p.phoneNumber ?? "",
        street_address: p.streetAddress ?? "",
        address_line_2: p.addressLine2 ?? "",
        city: p.city ?? "",
        state_or_territory: (p.stateOrTerritory ?? "AL") as USStateTerritory,
        postal_code: p.postalCode ?? "",
        country: "United States",
        role: "customer",
      },
    });
  } catch (err: unknown) {
    // If another process created the row concurrently, treat as success
    if (isPrismaP2002(err)) {
      const target = (err as { meta?: { target?: unknown } }).meta?.target;
      if (Array.isArray(target) && target.includes("auth_user_id")) {
        return; // Concurrent create - success
      }
    }
    throw err;
  }

  // Best-effort: update Supabase auth metadata (non-blocking)
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (svcKey && url) {
    try {
      const admin = createAdminClient(url, svcKey, {
        auth: { persistSession: false },
      });
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { onboarded: true, profileDraft: null },
      });
    } catch (err) {
      // Non-blocking: log but don't fail onboarding
      console.error("Failed to update auth metadata:", err);
    }
  }
}

/**
 * onboardAction - server action for an authenticated user to submit their profile.
 * Validates session via cookie-aware server Supabase client, builds payload and calls runOnboardingTasks.
 */
export async function onboardAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return redirect(
        "/login?next=" + encodeURIComponent("/dashboard?onboard=1"),
      );
    }
    user = data.user;
  } catch {
    // redirect when session validation fails
    return redirect(
      "/login?next=" + encodeURIComponent("/dashboard?onboard=1"),
    );
  }

  const getString = (value: unknown): string | null => {
    const str = value != null ? String(value).trim() : "";
    return str !== "" ? str : null;
  };

  const normalizePhone = (phone?: string | null): string | null => {
    if (!phone) return null;
    // Extract digits only (user enters only the 10 digits after +1)
    const digits = phone.replace(/\D/g, "");
    // Must have exactly 10 digits
    if (digits.length === 10) return `+1${digits}`;
    return null;
  };

  const rawPhoneNumber = getString(formData.get("phoneNumber"));
  const normalizedPhone = rawPhoneNumber
    ? normalizePhone(rawPhoneNumber)
    : null;

  // Validate phone number if provided
  if (rawPhoneNumber && (!normalizedPhone || normalizedPhone.length !== 12)) {
    return redirect(
      "/dashboard?onboard_error=1&message=" +
        encodeURIComponent(
          "Invalid phone number format. Please enter a valid 10-digit US phone number.",
        ),
    );
  }

  const p = {
    username: String(formData.get("username") ?? ""),
    firstName: getString(formData.get("firstName")),
    lastName: getString(formData.get("lastName")),
    email: getString(formData.get("email")),
    phoneNumber: normalizedPhone,
    streetAddress: getString(formData.get("streetAddress")),
    addressLine2: getString(formData.get("addressLine2")),
    city: getString(formData.get("city")),
    stateOrTerritory: getString(
      formData.get("stateOrTerritory"),
    ) as USStateTerritory | null,
    postalCode: getString(formData.get("postalCode")),
  };

  try {
    await runOnboardingTasks(user.id, p);
    return redirect("/dashboard");
  } catch (err: unknown) {
    console.error("[onboardAction] onboarding failed", err);
    // Redirect to dashboard and surface an onboarding_error flag so UI can react.
    return redirect("/dashboard?onboard_error=1");
  }
}

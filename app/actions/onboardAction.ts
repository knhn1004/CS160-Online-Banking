"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";
import type { USStateTerritory } from "@prisma/client";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const prisma = getPrisma();

// Type guard for Prisma P2002 duplicate-key error.
function isPrismaP2002(
  err: unknown,
): err is { code: string; meta?: { target?: unknown } } {
  if (typeof err !== "object" || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return typeof maybe.code === "string" && maybe.code === "P2002";
}

function hasAdminUpdateUserById(obj: unknown): obj is {
  auth: { admin: { updateUserById: (...args: unknown[]) => Promise<unknown> } };
} {
  if (typeof obj !== "object" || obj === null) return false;
  const auth = (obj as Record<string, unknown>).auth;
  if (typeof auth !== "object" || auth === null) return false;
  const admin = (auth as Record<string, unknown>).admin;
  if (typeof admin !== "object" || admin === null) return false;
  return (
    typeof (admin as Record<string, unknown>).updateUserById === "function"
  );
}

function hasAuthUpdateUser(
  obj: unknown,
): obj is { auth: { updateUser: (...args: unknown[]) => Promise<unknown> } } {
  if (typeof obj !== "object" || obj === null) return false;
  const auth = (obj as Record<string, unknown>).auth;
  if (typeof auth !== "object" || auth === null) return false;
  return typeof (auth as Record<string, unknown>).updateUser === "function";
}

/**
 * runOnboardingTasks - create a DB user row (create-only, idempotent) and attempt
 * a best-effort admin metadata update in Supabase (server-only, service role).
 *
 * - Creates a user row if missing. If a concurrent process created the row the
 *   Prisma P2002 duplicate-key error is treated as success.
 * - Attempts to clear profileDraft / set onboarded flag in Supabase auth metadata
 *   using a service-role client when SUPABASE_SERVICE_ROLE_KEY is available.
 *
 * Throws on unexpected failures so callers (signupAction / onboardAction) can handle them.
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
  console.debug("[runOnboardingTasks] start", { userId, username: p.username });

  // Create-only (race-safe via P2002 handling)
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
    console.debug("[runOnboardingTasks] created user row", { userId });
  } catch (err: unknown) {
    if (isPrismaP2002(err)) {
      const target = (err as { meta?: { target?: unknown } }).meta?.target;
      if (Array.isArray(target) && target.includes("auth_user_id")) {
        // Another process created the row concurrently — treat as success.
        console.debug(
          "[runOnboardingTasks] concurrent create detected; treating as success",
          { userId },
        );
      } else {
        console.error("[runOnboardingTasks] user create failed", err);
        throw err;
      }
    } else {
      console.error("[runOnboardingTasks] user create failed", err);
      throw err;
    }
  }

  // Best-effort: update Supabase auth user metadata using service-role key (server only)
  try {
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (svcKey && url) {
      const admin = createAdminClient(url, svcKey, {
        auth: { persistSession: false },
      });
      const metadataUpdate = {
        user_metadata: { onboarded: true, profileDraft: null },
      };

      if (hasAdminUpdateUserById(admin)) {
        await admin.auth.admin.updateUserById(userId, metadataUpdate);
      } else if (hasAuthUpdateUser(admin)) {
        // fallback if client exposes updateUser
        await admin.auth.updateUser({
          id: userId,
          data: metadataUpdate.user_metadata,
        });
      } else {
        console.debug(
          "[runOnboardingTasks] admin update method not available on this supabase client version",
        );
      }
      console.debug(
        "[runOnboardingTasks] updated auth metadata (best-effort)",
        { userId },
      );
    } else {
      console.debug(
        "[runOnboardingTasks] no service role key; skipped clearing profileDraft in auth",
      );
    }
  } catch (err: unknown) {
    // Don't fail the whole onboarding just because auth metadata update failed,
    // but surface the error in logs for diagnostics.
    console.debug("[runOnboardingTasks] failed to update auth metadata", err);
  }

  console.debug("[runOnboardingTasks] completed", { userId });
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

  const payload = Object.fromEntries(formData.entries()) as Record<
    string,
    unknown
  >;
  const p = {
    username: String(payload.username ?? ""),
    firstName:
      payload.firstName != null && String(payload.firstName ?? "") !== ""
        ? String(payload.firstName)
        : null,
    lastName:
      payload.lastName != null && String(payload.lastName ?? "") !== ""
        ? String(payload.lastName)
        : null,
    email:
      payload.email != null && String(payload.email ?? "") !== ""
        ? String(payload.email)
        : null,
    phoneNumber:
      payload.phoneNumber != null && String(payload.phoneNumber ?? "") !== ""
        ? String(payload.phoneNumber)
        : null,
    streetAddress:
      payload.streetAddress != null &&
      String(payload.streetAddress ?? "") !== ""
        ? String(payload.streetAddress)
        : null,
    addressLine2:
      payload.addressLine2 != null && String(payload.addressLine2 ?? "") !== ""
        ? String(payload.addressLine2)
        : null,
    city:
      payload.city != null && String(payload.city ?? "") !== ""
        ? String(payload.city)
        : null,
    stateOrTerritory:
      payload.stateOrTerritory != null &&
      String(payload.stateOrTerritory ?? "") !== ""
        ? (String(payload.stateOrTerritory) as unknown as USStateTerritory)
        : null,
    postalCode:
      payload.postalCode != null && String(payload.postalCode ?? "") !== ""
        ? String(payload.postalCode)
        : null,
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

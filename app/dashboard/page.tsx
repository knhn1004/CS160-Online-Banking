import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";
import { runOnboardingTasks } from "@/app/actions/onboardAction";
import { getDashboardData } from "./data";
import { DashboardClient } from "./dashboard-client";
import type { USStateTerritory } from "@prisma/client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user =
    (data as unknown as { user?: Record<string, unknown> })?.user ?? null;

  // Not signed in -> require login
  if (!user) {
    return redirect("/login?next=" + encodeURIComponent("/dashboard"));
  }

  const prisma = getPrisma();

  const userRec = user as Record<string, unknown>;
  const userId = typeof userRec.id === "string" ? userRec.id : null;
  if (!userId) {
    console.error("[dashboard] missing or invalid user id on session");
    return redirect("/login?next=" + encodeURIComponent("/dashboard"));
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { auth_user_id: userId },
      select: { id: true },
    });

    if (!existing) {
      // Use any saved profileDraft in user_metadata, fallback to sensible defaults.
      const userMeta = (user as Record<string, unknown>)["user_metadata"];
      const draft =
        userMeta && typeof userMeta === "object"
          ? (((userMeta as Record<string, unknown>)["profileDraft"] as
              | Record<string, unknown>
              | undefined) ?? {})
          : {};

      // Narrow/normalize runtime values so TypeScript knows the types are safe.
      const emailStr = typeof userRec.email === "string" ? userRec.email : null;
      const idStr = String(userRec.id ?? "");

      const d = draft as Record<string, unknown>;
      const draftUsername =
        typeof d.username === "string" ? d.username : undefined;
      const usernameFromEmail = emailStr ? emailStr.split("@")[0] : undefined;
      const usernameDefault = String(
        draftUsername ?? usernameFromEmail ?? `user-${idStr.slice(0, 8)}`,
      );

      const firstName = typeof d.firstName === "string" ? d.firstName : null;
      const lastName = typeof d.lastName === "string" ? d.lastName : null;
      const phoneNumber =
        typeof d.phoneNumber === "string" ? d.phoneNumber : null;
      const streetAddress =
        typeof d.streetAddress === "string" ? d.streetAddress : null;
      const addressLine2 =
        typeof d.addressLine2 === "string" ? d.addressLine2 : null;
      const city = typeof d.city === "string" ? d.city : null;
      const postalCode = typeof d.postalCode === "string" ? d.postalCode : null;

      // state must be validated at runtime; cast only if it's a string
      const rawState = d.stateOrTerritory;
      const stateOrTerritory =
        typeof rawState === "string" ? (rawState as USStateTerritory) : null;

      const payload = {
        username: usernameDefault,
        firstName,
        lastName,
        email: emailStr,
        phoneNumber,
        streetAddress,
        addressLine2,
        city,
        stateOrTerritory,
        postalCode,
      };

      console.debug("[dashboard] running onboarding for user", {
        userId: idStr,
      });
      try {
        await runOnboardingTasks(idStr, payload);
        console.debug("[dashboard] onboarding complete for user", {
          userId: idStr,
        });
      } catch (err: unknown) {
        console.error("[dashboard] onboarding failed", err);
        // don't block rendering; UI can show a banner if you read a query param
      }
    }
  } catch (err: unknown) {
    console.error("[dashboard] failed to check/create user row", err);
  }

  // Now fetch dashboard data (after onboarding attempt)
  const dashboardData = await getDashboardData();

  return <DashboardClient initialData={dashboardData} />;
}

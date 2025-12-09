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
      // Extract profile draft from user metadata or use defaults
      const userMeta = (user as Record<string, unknown>).user_metadata as
        | Record<string, unknown>
        | undefined;
      const draft = (userMeta?.profileDraft as Record<string, unknown>) ?? {};
      const email = (userRec.email as string) ?? null;
      const emailPrefix = email ? email.split("@")[0] : undefined;
      const userIdPrefix = String(userRec.id ?? "").slice(0, 8);

      const getString = (key: string): string | null => {
        const value = draft[key];
        return typeof value === "string" ? value : null;
      };

      try {
        await runOnboardingTasks(userId, {
          username:
            getString("username") ?? emailPrefix ?? `user-${userIdPrefix}`,
          firstName: getString("firstName"),
          lastName: getString("lastName"),
          email,
          phoneNumber: getString("phoneNumber"),
          streetAddress: getString("streetAddress"),
          addressLine2: getString("addressLine2"),
          city: getString("city"),
          stateOrTerritory: getString(
            "stateOrTerritory",
          ) as USStateTerritory | null,
          postalCode: getString("postalCode"),
        });
      } catch (err) {
        console.error("Onboarding failed:", err);
        // Don't block rendering - UI can show error banner
      }
    }
  } catch (err: unknown) {
    console.error("[dashboard] failed to check/create user row", err);
  }

  // Now fetch dashboard data (after onboarding attempt)
  const dashboardData = await getDashboardData();

  return <DashboardClient initialData={dashboardData} />;
}

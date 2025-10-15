import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

// Configure route segment - transactions should be dynamic
export const dynamic = "force-dynamic";
export const revalidate = 0; // Don't cache for real-time transaction data

export async function GET(request: Request) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      headers: { "Content-Type": "application/json" },
      status: auth.status,
    });
  }
  const currentUser = await getPrisma().user.findUnique({
    where: { auth_user_id: auth.supabaseUser.id },
    include: {
      internal_accounts: true,
    },
  });
  if (!currentUser) {
    return new Response(JSON.stringify({ message: "User not onboarded" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }

  const accountIds = currentUser.internal_accounts.map((acc) => acc.id);

  const transactions = await getPrisma().transaction.findMany({
    where: {
      internal_account_id: {
        in: accountIds,
      },
    },
    orderBy: {
      created_at: "desc",
    },
    take: 10,
  });
  return new Response(JSON.stringify({ transactions }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}

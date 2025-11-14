import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { json } from "@/app/lib/transactions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/accounts/balance
 * Lightweight endpoint to check account balances
 * Useful for polling/real-time updates after API key transactions
 * Returns minimal data for quick cache invalidation checks
 */
export async function GET(request: Request) {
  try {
    const auth = await getAuthUserFromRequest(request);
    if (!auth.ok) {
      return new Response(JSON.stringify(auth.body), {
        headers: { "Content-Type": "application/json" },
        status: auth.status,
      });
    }

    const prisma = getPrisma();

    // Get user's database ID
    const user = await prisma.user.findUnique({
      where: { auth_user_id: auth.supabaseUser.id },
      select: { id: true },
    });

    if (!user) {
      return json(404, { error: "User not found" });
    }

    // Get account balances (minimal query)
    const accounts = await prisma.internalAccount.findMany({
      where: {
        user_id: user.id,
        is_active: true,
      },
      select: {
        id: true,
        account_number: true,
        balance: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return json(200, {
      accounts: Array.isArray(accounts)
        ? accounts.map((acc) => ({
            id: acc.id,
            account_number: acc.account_number,
            balance: Number(acc.balance),
            created_at: acc.created_at.toISOString(),
          }))
        : [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching account balances:", error);
    return json(500, { error: "Internal server error" });
  }
}

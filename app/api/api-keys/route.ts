import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { json } from "@/app/lib/transactions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/api-keys
 * Lists all API keys for the authenticated user
 * Requires JWT Bearer token
 * Returns keys without full key value (only prefix)
 */
export async function GET(request: Request) {
  try {
    // Authenticate user
    const auth = await getAuthUserFromRequest(request);
    if (!auth.ok) {
      return new Response(JSON.stringify(auth.body), {
        status: auth.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prisma = getPrisma();

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { auth_user_id: auth.supabaseUser.id },
    });

    if (!user) {
      return json(404, { error: "User not found" });
    }

    // Get all API keys for this user
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        internal_account: {
          select: {
            id: true,
            account_number: true,
            account_type: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Return keys without full key value
    const keys = apiKeys.map((key: (typeof apiKeys)[0]) => ({
      id: key.id,
      key_prefix: key.key_prefix,
      account_id: key.internal_account_id,
      account_number: key.internal_account.account_number,
      account_type: key.internal_account.account_type,
      expires_at: key.expires_at?.toISOString() || null,
      is_active: key.is_active,
      created_at: key.created_at.toISOString(),
      last_used_at: key.last_used_at?.toISOString() || null,
    }));

    return json(200, { api_keys: keys });
  } catch (error) {
    console.error("Error listing API keys:", error);
    return json(500, { error: "Internal server error" });
  }
}

import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { json } from "@/app/lib/transactions";
import { generateApiKey, hashApiKey, getKeyPrefix } from "@/lib/api-key-utils";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GenerateApiKeySchema = z.object({
  account_id: z.number().int().positive(),
  expires_at: z.string().datetime().nullable().optional(),
});

/**
 * POST /api/api-keys/generate
 * Generates a new API key for the authenticated user's account
 * Requires JWT Bearer token
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const auth = await getAuthUserFromRequest(request);
    if (!auth.ok) {
      return new Response(JSON.stringify(auth.body), {
        status: auth.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const parseResult = GenerateApiKeySchema.safeParse(raw);
    if (!parseResult.success) {
      return json(422, {
        error: "Invalid request body",
        details: parseResult.error.issues,
      });
    }

    const { account_id, expires_at } = parseResult.data;

    const prisma = getPrisma();

    // Verify user owns the account
    const account = await prisma.internalAccount.findUnique({
      where: { id: account_id },
      include: { user: true },
    });

    if (!account) {
      return json(404, { error: "Account not found" });
    }

    if (account.user.auth_user_id !== auth.supabaseUser.id) {
      return json(403, { error: "Forbidden: You do not own this account" });
    }

    if (!account.is_active) {
      return json(403, { error: "Forbidden: Account is inactive" });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const keyPrefix = getKeyPrefix(apiKey);

    // Parse expiration date if provided
    let expiresAtDate: Date | null = null;
    if (expires_at) {
      expiresAtDate = new Date(expires_at);
      if (isNaN(expiresAtDate.getTime())) {
        return json(400, { error: "Invalid expiration date format" });
      }
    }

    // Get user ID from database
    const user = await prisma.user.findUnique({
      where: { auth_user_id: auth.supabaseUser.id },
    });

    if (!user) {
      return json(404, { error: "User not found" });
    }

    // Store API key in database
    const createdKey = await prisma.apiKey.create({
      data: {
        user_id: user.id,
        internal_account_id: account_id,
        api_key_hash: apiKeyHash,
        key_prefix: keyPrefix,
        expires_at: expiresAtDate,
        is_active: true,
      },
    });

    // Return the full API key (only time it's shown)
    return json(200, {
      api_key: apiKey,
      key_id: createdKey.id,
      key_prefix: keyPrefix,
      account_id: account_id,
      account_number: account.account_number,
      expires_at: expiresAtDate?.toISOString() || null,
      created_at: createdKey.created_at.toISOString(),
    });
  } catch (error) {
    console.error("Error generating API key:", error);
    return json(500, { error: "Internal server error" });
  }
}

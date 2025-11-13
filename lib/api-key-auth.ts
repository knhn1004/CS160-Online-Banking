import { getPrisma } from "@/app/lib/prisma";
import { verifyApiKey } from "./api-key-utils";

export type ApiKeyAuthResult =
  | {
      ok: true;
      accountId: number;
      userId: number;
      apiKeyId: number;
    }
  | { ok: false; status: number; body: { message: string } };

/**
 * Validates an API key from the access_token query parameter
 * Checks expiration, active status, and hash match
 * @param apiKey The API key from the query parameter
 * @returns Auth result with account and user IDs if valid, error response otherwise
 */
export async function validateApiKey(
  apiKey: string,
): Promise<ApiKeyAuthResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { ok: false, status: 401, body: { message: "API key required" } };
  }

  const prisma = getPrisma();

  try {
    // Find all active API keys and check hash
    // We need to check all keys because we can't reverse the hash
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        is_active: true,
      },
      include: {
        internal_account: true,
      },
    });

    // Find matching key by verifying hash
    let matchedKey = null;
    for (const key of apiKeys) {
      if (verifyApiKey(apiKey, key.api_key_hash)) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      return {
        ok: false,
        status: 401,
        body: { message: "Invalid API key" },
      };
    }

    // Check expiration
    if (matchedKey.expires_at && matchedKey.expires_at < new Date()) {
      return {
        ok: false,
        status: 401,
        body: { message: "API key has expired" },
      };
    }

    // Update last_used_at timestamp
    await prisma.apiKey.update({
      where: { id: matchedKey.id },
      data: { last_used_at: new Date() },
    });

    return {
      ok: true,
      accountId: matchedKey.internal_account_id,
      userId: matchedKey.user_id,
      apiKeyId: matchedKey.id,
    };
  } catch (error) {
    console.error("Error validating API key:", error);
    return {
      ok: false,
      status: 500,
      body: { message: "Internal server error" },
    };
  }
}
/**
 * Helper to extract API key from request query parameters
 */
export function extractApiKeyFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("access_token");
}

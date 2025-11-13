import { getPrisma } from "@/app/lib/prisma";
import {
  json,
  Amount,
  createDeniedTransaction,
  findExistingTransaction,
  createApprovedTransaction,
} from "@/app/lib/transactions";
import { validateApiKey, extractApiKeyFromRequest } from "@/lib/api-key-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ApiKeyTransactionSchema = z.object({
  transaction_type: z.enum(["credit", "debit"]),
  amount: Amount,
  account_number: z.string().optional(), // Optional - defaults to API key's account
});

/**
 * POST /api/api-keys/transactions?access_token=...
 * Processes a credit or debit transaction using API key authentication
 * No JWT required - uses access_token query parameter
 */
export async function POST(request: Request) {
  try {
    // Extract API key from query parameter
    const apiKey = extractApiKeyFromRequest(request);
    if (!apiKey) {
      return json(401, {
        error: "API key required in access_token query parameter",
      });
    }

    // Validate API key
    const auth = await validateApiKey(apiKey);
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

    const parseResult = ApiKeyTransactionSchema.safeParse(raw);
    if (!parseResult.success) {
      return json(422, {
        error: "Invalid request body",
        details: parseResult.error.issues,
      });
    }

    const { transaction_type, amount, account_number } = parseResult.data;

    const prisma = getPrisma();

    // Get the account - use provided account_number or default to API key's account
    let targetAccountId = auth.accountId;
    if (account_number) {
      const account = await prisma.internalAccount.findUnique({
        where: { account_number },
      });
      if (!account) {
        return json(404, { error: "Account not found" });
      }
      // Verify the account belongs to the same user as the API key
      if (account.user_id !== auth.userId) {
        return json(403, {
          error: "Forbidden: API key cannot access this account",
        });
      }
      targetAccountId = account.id;
    }

    // Get account details
    const account = await prisma.internalAccount.findUnique({
      where: { id: targetAccountId },
      include: { user: true },
    });

    if (!account) {
      return json(404, { error: "Account not found" });
    }

    if (!account.is_active) {
      return json(403, {
        error: "Forbidden: Account is inactive",
      });
    }

    // Generate idempotency key from API key ID and timestamp
    const idempotency_key = `api_key_${auth.apiKeyId}_${Date.now()}`;

    // Process transaction based on type
    if (transaction_type === "credit") {
      // Credit = Deposit (inbound)
      return await prisma.$transaction(async (tx) => {
        const existing = await findExistingTransaction(tx, {
          idempotency_key,
          transaction_type: "deposit",
          internal_account_id: account.id,
          amount,
        });
        if (existing) {
          return json(200, {
            status: "Credit already processed (idempotency key found)",
          });
        }

        await tx.internalAccount.update({
          where: { id: account.id },
          data: { balance: { increment: amount } },
        });

        const result = await createApprovedTransaction(
          tx,
          {
            internal_account_id: account.id,
            amount,
            transaction_type: "deposit",
            direction: "inbound",
            idempotency_key,
          },
          "Credit already processed",
        );

        const responseData = {
          status: result.duplicate ? result.message : "Credit successful",
          transaction_id: result.transaction?.id,
          amount: Number(amount),
        };

        // Invalidate cache after successful transaction
        const { revalidateTag } = await import("next/cache");
        await revalidateTag(`user-${auth.userId}`);
        await revalidateTag(`transactions-${auth.userId}`);
        await revalidateTag(`accounts-${auth.userId}`);

        return json(200, responseData);
      });
    } else {
      // Debit = Withdrawal (outbound)
      return await prisma.$transaction(async (tx) => {
        const existing = await findExistingTransaction(tx, {
          idempotency_key,
          transaction_type: "withdrawal",
          internal_account_id: account.id,
          amount: amount.neg(),
        });
        if (existing) {
          return json(200, {
            status: "Debit already processed (idempotency key found)",
          });
        }

        // Check sufficient funds
        const ok = await tx.internalAccount.updateMany({
          where: { id: account.id, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });

        if (ok.count !== 1) {
          await createDeniedTransaction(tx, {
            internal_account_id: account.id,
            amount: amount.neg(),
            transaction_type: "withdrawal",
            direction: "outbound",
            idempotency_key,
          });
          return json(409, { error: "Conflict: Insufficient funds" });
        }

        const result = await createApprovedTransaction(
          tx,
          {
            internal_account_id: account.id,
            amount: amount.neg(),
            transaction_type: "withdrawal",
            direction: "outbound",
            idempotency_key,
          },
          "Debit already processed",
        );

        const responseData = {
          status: result.duplicate ? result.message : "Debit successful",
          transaction_id: result.transaction?.id,
          amount: Number(amount),
        };

        // Invalidate cache after successful transaction
        const { revalidateTag } = await import("next/cache");
        await revalidateTag(`user-${auth.userId}`);
        await revalidateTag(`transactions-${auth.userId}`);
        await revalidateTag(`accounts-${auth.userId}`);

        return json(200, responseData);
      });
    }
  } catch (error) {
    console.error("Error processing API key transaction:", error);
    return json(500, { error: "Internal server error" });
  }
}

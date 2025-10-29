import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { z } from "zod";

/* ============================================================================================================================
   HELPER FUNCTIONS FOR TRANSACTION PROCESSING
   ============================================================================================================================ */

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Amount validation to avoid floating point issues
export const Amount = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), "Invalid amount (max 2 dp)")
  .transform((v) => new Decimal(v))
  .refine((d) => Number(d) > 0, "Amount must be > 0");

// Helper to create a denied transaction record
export async function createDeniedTransaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  data: {
    internal_account_id: number;
    amount: Decimal;
    transaction_type: string;
    direction: string;
    idempotency_key?: string | null;
    bill_pay_rule_id?: number;
    transfer_rule_id?: number;
  },
) {
  return await tx.transaction.create({
    data: {
      ...data,
      status: "denied" as const,
    },
  });
}

// Helper to check for existing transaction by idempotency key
export async function findExistingTransaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  params: {
    idempotency_key?: string | null;
    transaction_type: string;
    internal_account_id: number;
    amount: Decimal;
    bill_pay_rule_id?: number;
    transfer_rule_id?: number;
  },
) {
  if (!params.idempotency_key) return null;

  return await tx.transaction.findFirst({
    where: {
      idempotency_key: params.idempotency_key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaction_type: params.transaction_type as any,
      internal_account_id: params.internal_account_id,
      amount: params.amount,
      ...(params.bill_pay_rule_id && {
        bill_pay_rule_id: params.bill_pay_rule_id,
      }),
      ...(params.transfer_rule_id && {
        transfer_rule_id: params.transfer_rule_id,
      }),
    },
  });
}

// Helper to create approved transaction with idempotency handling
export async function createApprovedTransaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  data: {
    internal_account_id: number;
    amount: Decimal;
    transaction_type: string;
    direction: string;
    idempotency_key?: string | null;
    bill_pay_rule_id?: number;
    transfer_rule_id?: number;
  },
  successMessage: string,
) {
  try {
    await tx.transaction.create({
      data: {
        ...data,
        status: "approved" as const,
      },
    });
    return { success: true, message: successMessage };
  } catch (e) {
    if (
      data.idempotency_key &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        success: true,
        message: `${successMessage} (idempotency key found).`,
        duplicate: true,
      };
    }
    throw e;
  }
}

// API route for handling transaction creation/processing.

import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { z } from "zod";

/* -------------------------------------------------------------- Helpers -------------------------------------------------------------- */

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Amount needs to be handled carefully to avoid floating point issues.
const Amount = z
  .union([z.string(), z.number()]) // Accepts either a string or a number as input.
  .transform((v) => (typeof v === "number" ? String(v) : v.trim())) // Converts input to a trimmed string.
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), "Invalid amount (max 2 dp)") // Validates input format (only 2 decimal places).
  .transform((v) => new Decimal(v)) // Converts the validated string to a Decimal instance.
  .refine((d) => d.gt(0), "Amount must be > 0"); // Ensures the amount is greater than zero.

/* -------------------------------------------------------------- Request Schemas ------------------------------------------------------- */

// CASE 1: Deposit - money is added to an INTERNAL account. This requires:
// (1) the destination account number (user's account number)
// (2) the amount to deposit
// (3) the transaction type ("deposit")
// (4) the direction of the transaction (in this case, "inbound")
const Deposit = z.object({
  requested_transaction_type: z.literal("deposit"),
  transaction_direction: z.literal("inbound"),
  destination_account_number: z.string().min(1),
  requested_amount: Amount,
});

// CASE 2: Withdrawal - money is taken out of an INTERNAL account. This requires:
// (1) the source account number (user's account number)
// (2) the amount to withdraw
// (3) the transaction type ("withdrawal")
// (4) the direction of the transaction (in this case, "outbound")
const Withdrawal = z.object({
  requested_transaction_type: z.literal("withdrawal"),
  transaction_direction: z.literal("outbound"),
  source_account_number: z.string().min(1),
  requested_amount: Amount,
});

// CASE 3: Bill Pay - money is taken out of an INTERNAL account to pay an EXTERNAL entity. This requires:
// (1) the transaction type ("billpay")
// (2) the bill pay rule ID (to identify the external entity being paid)
const Billpay = z.object({
  requested_transaction_type: z.literal("billpay"),
  bill_pay_rule_id: z.number().int(),
});

// CASE 4: Internal to External Transfer OR Internal to Internal Transfer - money is moved from an INTERNAL account to either another INTERNAL account or an EXTERNAL account. This requires:
// (1) the transaction type ("external_transfer" or "internal_transfer")
// (2): the transfer rule ID (to identify the external entity being transferred to/from)
const InternalTransfer = z.object({
  requested_transaction_type: z.literal("internal_transfer"),
  transfer_rule_id: z.number().int(),
});

const ExternalOutbound = z.object({
  requested_transaction_type: z.literal("external_transfer"),
  transfer_rule_id: z.number().int(),
  // direction is implied outbound by the rule
});

// CASE 5: External to Internal Transfer - money is moved from an EXTERNAL account to an INTERNAL account. This requires:
// (1) the source account number
// (2) the source routing number
// (3) the destination account number
// (4) the amount to transfer
// (5) the transaction type ("external_transfer")
// (6) the direction of the transaction ("inbound")
const ExternalInbound = z.object({
  requested_transaction_type: z.literal("external_transfer"),
  transaction_direction: z.literal("inbound"),
  destination_account_number: z.string().min(1),
  source_account_number: z.string().min(1),
  source_routing_number: z.string().min(1),
  requested_amount: Amount,
});

const TransactionRequestSchema = z.union([
  Deposit,
  Withdrawal,
  Billpay,
  InternalTransfer,
  ExternalOutbound,
  ExternalInbound,
]);

/* -------------------------------------------------------------- Route ----------------------------------------------------------------- */

export async function POST(request: Request) {
  try {
    // 1) Parse JSON body from request to catch malformed bodies.
    let raw: unknown;
    try {
      raw = await request.json();
    } catch (error) {
      console.error("Error parsing JSON body:", error);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON body.",
        }),
        {
          status: 400,
        },
      );
    }

    // 2) Runtime validation of request body using Zod schema.
    const parseResult = TransactionRequestSchema.safeParse(raw);
    if (!parseResult.success) {
      return json(422, {
        error: "Invalid request body.",
        details: z.treeifyError(parseResult.error),
      });
    }
    const request_body = parseResult.data;

    // 3) Authenticate user from request (checks for valid session).
    // NOTE: The EXTERNAL to INTERNAL transfer case is ALWAYS initiated by a third-party, so we skip user authentication for this case only.
    const requiresUserAuth = !(
      request_body.requested_transaction_type === "external_transfer" &&
      "transaction_direction" in request_body &&
      request_body.transaction_direction === "inbound"
    );

    // Taken from "getAuthUserFromRequest" in "lib/auth.ts".
    type AuthResult =
      | {
          ok: true;
          supabaseUser: {
            id: string;
            email?: string | null;
            name?: string | null;
          };
        }
      | { ok: false; status: number; body: { message: string } };

    let auth: AuthResult | null = null;

    if (requiresUserAuth) {
      auth = await getAuthUserFromRequest(request);
      if (!auth.ok) {
        return new Response(JSON.stringify(auth.body), {
          status: auth.status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 4) Idempotency key handling (to prevent duplicate transactions on retries).
    const idempotency_key = request.headers.get("Idempotency-Key")?.trim();

    const prisma = getPrisma();

    /* -------------------------------------------------------------- Handle Request Cases ---------------------------------------------- */
    // NOTE: In our banking application, transactions should be marked as "denied" for business reasons only, NOT for malformed requests/unauthorized access).
    // This includes insufficient funds, inactive accounts, and external payment failures.

    // CASE: Deposit
    if (request_body.requested_transaction_type === "deposit") {
      const { destination_account_number, requested_amount } = request_body;

      return await prisma.$transaction(async (tx) => {
        // a. Verify that the destination account exists and belongs to the authenticated user.
        const account = await tx.internalAccount.findUnique({
          where: { account_number: destination_account_number },
          include: { user: true },
        });

        if (!account) {
          return json(404, { error: "Destination account not found." });
        }

        if (
          !auth?.supabaseUser ||
          account.user.auth_user_id !== auth.supabaseUser.id
        ) {
          return json(404, { error: "Account not found." }); // Avoids ownership leakage!
        }

        // b. Check the status of the destination account.
        if (!account.is_active) {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: requested_amount,
              transaction_type: "deposit",
              direction: "inbound",
              status: "denied",
              idempotency_key: idempotency_key,
            },
          });
          return json(403, {
            error: "Forbidden: Destination account is inactive.",
          });
        }

        // c. Idempotency check: If a transaction with the same idempotency key already exists, return success status.
        const existingTransaction = await tx.transaction.findFirst({
          where: {
            idempotency_key: idempotency_key,
            transaction_type: "deposit",
            amount: requested_amount,
            internal_account_id: account.id,
          },
        });
        if (existingTransaction) {
          return json(200, {
            status: "Deposit already processed (idempotency key found).",
          });
        }

        // d. Apply the balance update and create the transaction record (atomic operation).
        await tx.internalAccount.update({
          where: { id: account.id },
          data: { balance: { increment: requested_amount } },
        });

        try {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: requested_amount,
              transaction_type: "deposit",
              direction: "inbound",
              status: "approved",
              idempotency_key: idempotency_key,
            },
          });
        } catch (e) {
          if (
            idempotency_key &&
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002" // Unique constraint violation provided by Prisma.
          ) {
            return json(200, {
              status: "Deposit already processed (idempotency key found).",
            });
          }
          throw e;
        }

        return json(200, { status: "Deposit successful." });
      });
    }

    // CASE: Withdrawal
    if (request_body.requested_transaction_type === "withdrawal") {
      const { source_account_number, requested_amount } = request_body;

      return await prisma.$transaction(async (tx) => {
        // a. Verify that the source account exists and belongs to the authenticated user.
        const account = await tx.internalAccount.findUnique({
          where: { account_number: source_account_number },
          include: { user: true },
        });

        if (!account) {
          return json(404, { error: "Source account not found." });
        }

        if (
          !auth?.supabaseUser ||
          account.user.auth_user_id !== auth.supabaseUser.id
        ) {
          return json(404, { error: "Account not found." }); // Avoids ownership leakage!
        }

        // b. Check the status of the source account.
        if (!account.is_active) {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: requested_amount.neg(),
              transaction_type: "withdrawal",
              direction: "outbound",
              status: "denied",
              idempotency_key: idempotency_key,
            },
          });
          return json(403, { error: "Forbidden: Source account is inactive." });
        }

        // c. Idempotency check: If a transaction with the same idempotency key already exists, return success status.
        const existingTransaction = await tx.transaction.findFirst({
          where: {
            idempotency_key: idempotency_key,
            transaction_type: "withdrawal",
            amount: requested_amount.neg(),
            internal_account_id: account.id,
          },
        });
        if (existingTransaction) {
          return json(200, {
            status: "Withdrawal already processed (idempotency key found).",
          });
        }

        // d. Check for sufficient funds.
        const ok = await tx.internalAccount.updateMany({
          where: { id: account.id, balance: { gte: requested_amount } },
          data: { balance: { decrement: requested_amount } },
        });

        if (ok.count !== 1) {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: requested_amount.neg(),
              transaction_type: "withdrawal",
              direction: "outbound",
              status: "denied",
              idempotency_key: idempotency_key,
            },
          });
          return json(409, { error: "Conflict: Insufficient funds." });
        }

        try {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: requested_amount.neg(),
              transaction_type: "withdrawal",
              direction: "outbound",
              status: "approved",
              idempotency_key: idempotency_key,
            },
          });
        } catch (e) {
          if (
            idempotency_key &&
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002" // Unique constraint violation provided by Prisma.
          ) {
            return json(200, {
              status: "Withdrawal already processed (idempotency key found).",
            });
          }
          throw e;
        }

        return json(200, { status: "Withdrawal successful." });
      });
    }

    // CASE: Bill Pay
    if (request_body.requested_transaction_type === "billpay") {
      const { bill_pay_rule_id } = request_body;

      return await prisma.$transaction(async (tx) => {
        // a. Verify that the bill pay rule exists and belongs to the authenticated user.
        const rule = await tx.billPayRule.findUnique({
          where: { id: bill_pay_rule_id },
          include: { user: true, source_internal: { include: { user: true } } },
        });

        if (!rule) {
          return json(404, { error: "Bill pay rule not found." });
        }

        if (
          !auth?.supabaseUser ||
          rule.user.auth_user_id !== auth.supabaseUser.id
        ) {
          return json(404, { error: "Bill pay rule not found." }); // Avoids ownership leakage!
        }

        // b. Check to see if the source account belongs to the authenticated user.
        const source = rule.source_internal;
        if (!source || source.user.auth_user_id !== auth.supabaseUser.id) {
          return json(404, { error: "Payer account not found." });
        }

        // b. Check the status of the source account.
        const account = rule.source_internal;
        if (!account.is_active) {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: rule.amount.neg(),
              transaction_type: "billpay",
              direction: "outbound",
              status: "denied",
              bill_pay_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
          return json(403, { error: "Forbidden: Source account is inactive." });
        }

        // c. Check to see if the payee is active.
        const payee = await tx.billPayPayee.findUnique({
          where: { id: rule.payee_id },
        });

        if (!payee || !payee.is_active) {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: rule.amount.neg(),
              transaction_type: "billpay",
              direction: "outbound",
              status: "denied",
              bill_pay_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
          return json(400, { error: "Forbidden: Payee is inactive." });
        }

        // d. Idempotency check: If a transaction with the same idempotency key already exists, return success status.
        if (idempotency_key) {
          const existingTransaction = await tx.transaction.findFirst({
            where: {
              idempotency_key: idempotency_key,
              transaction_type: "billpay",
              internal_account_id: account.id,
              amount: rule.amount.neg(),
              bill_pay_rule_id: rule.id,
            },
          });

          if (existingTransaction) {
            return json(200, {
              status:
                "Bill pay transaction already processed (idempotency key found).",
            });
          }
        }

        // e. TO-DO: Create mock external payment gateway.
        // Simulate external payment status.
        const paymentSuccess = true; // In real implementation, this would be the result of the external payment process.

        if (!paymentSuccess) {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: rule.amount.neg(),
              transaction_type: "billpay",
              direction: "outbound",
              status: "denied",
              bill_pay_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
          return json(502, { error: "Bad Gateway: External payment failed." });
        }

        // f. Atomic guard against double processing on idempotency key.
        const ok = await tx.internalAccount.updateMany({
          where: { id: source.id, balance: { gte: rule.amount } },
          data: { balance: { decrement: rule.amount } },
        });

        if (ok.count !== 1) {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: rule.amount.neg(),
              transaction_type: "billpay",
              direction: "outbound",
              status: "denied",
              bill_pay_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
          return json(409, { error: "Conflict: Insufficient funds." });
        }

        try {
          await tx.transaction.create({
            data: {
              internal_account_id: account.id,
              amount: rule.amount.neg(),
              transaction_type: "billpay",
              direction: "outbound",
              status: "approved",
              bill_pay_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
        } catch (e) {
          if (
            idempotency_key &&
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002" // Unique constraint violation provided by Prisma.
          ) {
            return json(200, {
              status:
                "Bill pay transaction already processed (idempotency key found).",
            });
          }
          throw e;
        }

        return json(200, { status: "Bill pay successful." });
      });
    }

    // CASE: Internal to Internal Transfer
    if (request_body.requested_transaction_type === "internal_transfer") {
      const { transfer_rule_id } = request_body;

      return await prisma.$transaction(async (tx) => {
        const rule = await tx.transferRule.findUnique({
          where: { id: transfer_rule_id },
          include: {
            user: true,
            source_internal: { include: { user: true } },
            destination_internal: true,
          },
        });

        // a. Verify that the transfer rule exists and belongs to the authenticated user.
        if (!rule) {
          return json(404, { error: "Transfer rule not found." });
        }

        if (
          !auth?.supabaseUser ||
          rule.user.auth_user_id !== auth.supabaseUser.id
        ) {
          return json(404, { error: "Transfer rule not found." }); // Avoids ownership leakage!
        }

        // b. Check to see if the source account belongs to the authenticated user.
        const source = rule.source_internal;
        if (!source || source.user.auth_user_id !== auth.supabaseUser.id) {
          return json(404, { error: "Source account not found." });
        }

        // c. Check to see if the destination account exists.
        const destination = rule.destination_internal;
        if (!destination) {
          return json(404, { error: "Destination account not found." });
        }

        // d. Check the status of the source and destination accounts.
        if (!source.is_active) {
          await tx.transaction.create({
            data: {
              internal_account_id: source.id,
              amount: rule.amount.neg(),
              transaction_type: "internal_transfer",
              direction: "outbound",
              status: "denied",
              transfer_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
          return json(403, { error: "Forbidden: Source account is inactive." });
        }

        if (!destination.is_active) {
          await tx.transaction.create({
            data: {
              internal_account_id: source.id,
              amount: rule.amount.neg(),
              transaction_type: "internal_transfer",
              direction: "outbound",
              status: "denied",
              transfer_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
          return json(403, {
            error: "Forbidden: Destination account is inactive.",
          });
        }

        // e. Idempotency check: If a transaction with the same idempotency key already exists, return success status.
        if (idempotency_key) {
          const existingTransaction = await tx.transaction.findFirst({
            where: {
              idempotency_key: idempotency_key,
              transaction_type: "internal_transfer",
              internal_account_id: source.id,
              amount: rule.amount.neg(),
              transfer_rule_id: rule.id,
            },
          });
          if (existingTransaction) {
            return json(200, {
              status:
                "Internal transfer already processed (idempotency key found).",
            });
          }
        }

        // f. Atomic guard against double processing on idempotency key.
        const ok = await tx.internalAccount.updateMany({
          where: { id: source.id, balance: { gte: rule.amount } },
          data: { balance: { decrement: rule.amount } },
        });

        if (ok.count !== 1) {
          await tx.transaction.create({
            data: {
              internal_account_id: source.id,
              amount: rule.amount.neg(),
              transaction_type: "internal_transfer",
              direction: "outbound",
              status: "denied",
              transfer_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
          return json(409, {
            error: "Conflict: Insufficient funds in source account.",
          });
        }

        // g. Credit the destination account.
        await tx.internalAccount.update({
          where: { id: destination.id },
          data: { balance: { increment: rule.amount } },
        });

        try {
          await tx.transaction.create({
            data: {
              internal_account_id: source.id,
              amount: rule.amount.neg(),
              transaction_type: "internal_transfer",
              direction: "outbound",
              status: "approved",
              transfer_rule_id: rule.id,
              idempotency_key: idempotency_key,
            },
          });
        } catch (e) {
          if (
            idempotency_key &&
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002" // Unique constraint violation provided by Prisma.
          ) {
            return json(200, {
              status:
                "Internal transfer already processed (idempotency key found).",
            });
          }
          throw e;
        }

        await tx.transaction.create({
          data: {
            internal_account_id: destination.id,
            amount: rule.amount,
            transaction_type: "internal_transfer",
            direction: "inbound",
            status: "approved",
            transfer_rule_id: rule.id,
            idempotency_key: idempotency_key,
          },
        });

        return json(200, { status: "Internal transfer successful." });
      });
    }

    // CASE: External Transfers
    if (request_body.requested_transaction_type === "external_transfer") {
      // Branch on whether we have the transfer_rule_id (outbound) or the source/destination account numbers (inbound).
      if ("transfer_rule_id" in request_body) {
        // Outbound transfer (from internal to external).
        const { transfer_rule_id } = request_body;

        return await prisma.$transaction(async (tx) => {
          const rule = await tx.transferRule.findUnique({
            where: { id: transfer_rule_id },
            include: {
              user: true,
              source_internal: { include: { user: true } },
              destination_external: true,
            },
          });

          // a. Verify that the transfer rule exists and belongs to the authenticated user.
          if (!rule) {
            return json(404, { error: "Transfer rule not found." });
          }

          if (
            !auth?.supabaseUser ||
            rule.user.auth_user_id !== auth.supabaseUser.id
          ) {
            return json(404, { error: "Transfer rule not found." }); // Avoids ownership leakage!
          }

          // b. Check to see if the source account belongs to the authenticated user.
          const source = rule.source_internal;
          if (!source || source.user.auth_user_id !== auth.supabaseUser.id) {
            return json(404, { error: "Source account not found." });
          }

          // c. Check to see the status of the source account.
          if (!source.is_active) {
            await tx.transaction.create({
              data: {
                internal_account_id: source.id,
                amount: rule.amount.neg(),
                transaction_type: "external_transfer",
                direction: "outbound",
                status: "denied",
                transfer_rule_id: rule.id,
                idempotency_key: idempotency_key,
              },
            });
            return json(403, {
              error: "Forbidden: Source account is inactive.",
            });
          }

          // d. Idempotency check: If a transaction with the same idempotency key already exists, return success status.
          if (idempotency_key) {
            const existingTransaction = await tx.transaction.findFirst({
              where: {
                idempotency_key: idempotency_key,
                transaction_type: "external_transfer",
                internal_account_id: source.id,
                amount: rule.amount.neg(),
                transfer_rule_id: rule.id,
              },
            });

            if (existingTransaction) {
              return json(200, {
                status:
                  "External transfer already processed (idempotency key found).",
              });
            }
          }

          // e. TO-DO: Create mock external payment gateway.
          // Simulate external payment status.
          const paymentSuccess = true; // In real implementation, this would be the result of the external payment process.

          if (!paymentSuccess) {
            await tx.transaction.create({
              data: {
                internal_account_id: source.id,
                amount: rule.amount.neg(),
                transaction_type: "external_transfer",
                direction: "outbound",
                status: "denied",
                transfer_rule_id: rule.id,
                idempotency_key: idempotency_key,
              },
            });
            return json(502, {
              error: "Bad Gateway: External payment failed.",
            });
          }

          // f. Atomic debit from the source account.
          const ok = await tx.internalAccount.updateMany({
            where: { id: source.id, balance: { gte: rule.amount } },
            data: { balance: { decrement: rule.amount } },
          });

          if (ok.count !== 1) {
            await tx.transaction.create({
              data: {
                internal_account_id: source.id,
                amount: rule.amount.neg(),
                transaction_type: "external_transfer",
                direction: "outbound",
                status: "denied",
                transfer_rule_id: rule.id,
                idempotency_key: idempotency_key,
              },
            });
            return json(409, {
              error: "Conflict: Insufficient funds in source account.",
            });
          }

          try {
            await tx.transaction.create({
              data: {
                internal_account_id: source.id,
                amount: rule.amount.neg(),
                transaction_type: "external_transfer",
                direction: "outbound",
                status: "approved",
                transfer_rule_id: rule.id,
                idempotency_key: idempotency_key,
              },
            });
          } catch (e) {
            if (
              idempotency_key &&
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === "P2002" // Unique constraint violation provided by Prisma.
            ) {
              return json(200, {
                status:
                  "External transfer already processed (idempotency key found).",
              });
            }
            throw e;
          }

          return json(200, {
            status: "External transfer from internal account successful.",
          });
        });
      } else {
        // Inbound transfer (from external to internal).
        const {
          destination_account_number,
          source_account_number,
          source_routing_number,
          requested_amount,
        } = request_body;

        return await prisma.$transaction(async (tx) => {
          // NOTE: In a real system, we'd verify the third-party service as well as provide the source account number and routing number to the external payment processor.
          // a. Verify that the destination account exists.
          const account = await tx.internalAccount.findUnique({
            where: { account_number: destination_account_number },
            include: { user: true },
          });

          if (!account) {
            return json(404, { error: "Destination account not found." });
          }

          // b. Check the status of the destination account.
          if (!account.is_active) {
            await tx.transaction.create({
              data: {
                internal_account_id: account.id,
                amount: requested_amount,
                transaction_type: "external_transfer",
                direction: "inbound",
                status: "denied",
                idempotency_key: idempotency_key,
              },
            });
            return json(403, {
              error: "Forbidden: Destination account is inactive.",
            });
          }

          // c. Idempotency check: If a transaction with the same idempotency key already exists, return success status.
          const existingTransaction = await tx.transaction.findFirst({
            where: {
              idempotency_key: idempotency_key,
              transaction_type: "external_transfer",
              amount: requested_amount,
              internal_account_id: account.id,
            },
          });
          if (existingTransaction) {
            return json(200, {
              status:
                "External transfer already processed (idempotency key found).",
            });
          }

          // d. Credit the destination account and create the transaction record (atomic operation).
          await tx.internalAccount.update({
            where: { id: account.id },
            data: { balance: { increment: requested_amount } },
          });

          try {
            await tx.transaction.create({
              data: {
                internal_account_id: account.id,
                amount: requested_amount,
                transaction_type: "external_transfer",
                direction: "inbound",
                status: "approved",
                idempotency_key: idempotency_key,
              },
            });
          } catch (e) {
            if (
              idempotency_key &&
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === "P2002" // Unique constraint violation provided by Prisma.
            ) {
              return json(200, {
                status:
                  "External transfer already processed (idempotency key found).",
              });
            }
            throw e;
          }

          return json(200, {
            status: "External transfer to internal account successful.",
          });
        });
      }
    }

    // If we reach here, something went wrong.
    return json(500, {
      error: "Internal Server Error: Unhandled transaction case.",
    });
  } catch (error) {
    console.error("Error processing transaction:", error);
    return json(500, { error: "Internal Server Error" });
  }
}

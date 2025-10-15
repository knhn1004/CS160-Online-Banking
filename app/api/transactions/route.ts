import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import {
  json,
  Amount,
  createDeniedTransaction,
  findExistingTransaction,
  createApprovedTransaction,
} from "@/app/lib/transactions";
import { z } from "zod";

// Configure route segment - transactions should be dynamic
export const dynamic = "force-dynamic";
export const revalidate = 0; // Don't cache for real-time transaction data

/* ============================================================================================================================
   REQUEST SCHEMAS
   ============================================================================================================================ */

const Deposit = z.object({
  requested_transaction_type: z.literal("deposit"),
  transaction_direction: z.literal("inbound"),
  destination_account_number: z.string().min(1),
  requested_amount: Amount,
});

const Withdrawal = z.object({
  requested_transaction_type: z.literal("withdrawal"),
  transaction_direction: z.literal("outbound"),
  source_account_number: z.string().min(1),
  requested_amount: Amount,
});

const Billpay = z.object({
  requested_transaction_type: z.literal("billpay"),
  bill_pay_rule_id: z.number().int(),
});

const InternalTransfer = z.object({
  requested_transaction_type: z.literal("internal_transfer"),
  transfer_rule_id: z.number().int(),
});

const ExternalOutbound = z.object({
  requested_transaction_type: z.literal("external_transfer"),
  transfer_rule_id: z.number().int(),
});

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

/* ============================================================================================================================
   GET ROUTE - Retrieve Recent Transactions
   ============================================================================================================================ */

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
    include: { internal_accounts: true },
  });

  if (!currentUser) {
    return new Response(JSON.stringify({ message: "User not onboarded" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }

  const accountIds = currentUser.internal_accounts.map((acc) => acc.id);
  const transactions = await getPrisma().transaction.findMany({
    where: { internal_account_id: { in: accountIds } },
    orderBy: { created_at: "desc" },
    take: 10,
  });

  return new Response(JSON.stringify({ transactions }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}

/* ============================================================================================================================
   POST ROUTE - Create/Process Transaction
   ============================================================================================================================ */

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    let raw: unknown;
    try {
      raw = await request.json();
    } catch (error) {
      console.error("Error parsing JSON body:", error);
      return json(400, { error: "Invalid JSON body." });
    }

    const parseResult = TransactionRequestSchema.safeParse(raw);
    if (!parseResult.success) {
      return json(422, {
        error: "Invalid request body.",
        details: z.treeifyError(parseResult.error),
      });
    }
    const request_body = parseResult.data;

    // Authenticate user (skip for external inbound transfers)
    const requiresUserAuth = !(
      request_body.requested_transaction_type === "external_transfer" &&
      "transaction_direction" in request_body &&
      request_body.transaction_direction === "inbound"
    );

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

    const idempotency_key = request.headers.get("Idempotency-Key")?.trim();
    const prisma = getPrisma();

    // Route to appropriate handler
    if (request_body.requested_transaction_type === "deposit") {
      return await handleDeposit(prisma, request_body, auth, idempotency_key);
    }

    if (request_body.requested_transaction_type === "withdrawal") {
      return await handleWithdrawal(
        prisma,
        request_body,
        auth,
        idempotency_key,
      );
    }

    if (request_body.requested_transaction_type === "billpay") {
      return await handleBillPay(prisma, request_body, auth, idempotency_key);
    }

    if (request_body.requested_transaction_type === "internal_transfer") {
      return await handleInternalTransfer(
        prisma,
        request_body,
        auth,
        idempotency_key,
      );
    }

    if (request_body.requested_transaction_type === "external_transfer") {
      if ("transfer_rule_id" in request_body) {
        return await handleExternalOutbound(
          prisma,
          request_body,
          auth,
          idempotency_key,
        );
      } else {
        return await handleExternalInbound(
          prisma,
          request_body,
          idempotency_key,
        );
      }
    }

    return json(500, {
      error: "Internal Server Error: Unhandled transaction case.",
    });
  } catch (error) {
    console.error("Error processing transaction:", error);
    return json(500, { error: "Internal Server Error" });
  }
}

/* ============================================================================================================================
   TRANSACTION HANDLERS
   ============================================================================================================================ */

async function handleDeposit(
  prisma: ReturnType<typeof getPrisma>,
  request_body: z.infer<typeof Deposit>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: any,
  idempotency_key?: string | null,
) {
  const { destination_account_number, requested_amount } = request_body;

  return await prisma.$transaction(async (tx) => {
    const account = await tx.internalAccount.findUnique({
      where: { account_number: destination_account_number },
      include: { user: true },
    });

    if (
      !account ||
      !auth?.supabaseUser ||
      account.user.auth_user_id !== auth.supabaseUser.id
    ) {
      return json(404, {
        error: account
          ? "Account not found."
          : "Destination account not found.",
      });
    }

    if (!account.is_active) {
      await createDeniedTransaction(tx, {
        internal_account_id: account.id,
        amount: requested_amount,
        transaction_type: "deposit",
        direction: "inbound",
        idempotency_key,
      });
      return json(403, {
        error: "Forbidden: Destination account is inactive.",
      });
    }

    const existing = await findExistingTransaction(tx, {
      idempotency_key,
      transaction_type: "deposit",
      internal_account_id: account.id,
      amount: requested_amount,
    });
    if (existing) {
      return json(200, {
        status: "Deposit already processed (idempotency key found).",
      });
    }

    await tx.internalAccount.update({
      where: { id: account.id },
      data: { balance: { increment: requested_amount } },
    });

    const result = await createApprovedTransaction(
      tx,
      {
        internal_account_id: account.id,
        amount: requested_amount,
        transaction_type: "deposit",
        direction: "inbound",
        idempotency_key,
      },
      "Deposit already processed",
    );

    return json(200, {
      status: result.duplicate ? result.message : "Deposit successful.",
    });
  });
}

async function handleWithdrawal(
  prisma: ReturnType<typeof getPrisma>,
  request_body: z.infer<typeof Withdrawal>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: any,
  idempotency_key?: string | null,
) {
  const { source_account_number, requested_amount } = request_body;

  return await prisma.$transaction(async (tx) => {
    const account = await tx.internalAccount.findUnique({
      where: { account_number: source_account_number },
      include: { user: true },
    });

    if (
      !account ||
      !auth?.supabaseUser ||
      account.user.auth_user_id !== auth.supabaseUser.id
    ) {
      return json(404, {
        error: account ? "Account not found." : "Source account not found.",
      });
    }

    if (!account.is_active) {
      await createDeniedTransaction(tx, {
        internal_account_id: account.id,
        amount: requested_amount.neg(),
        transaction_type: "withdrawal",
        direction: "outbound",
        idempotency_key,
      });
      return json(403, { error: "Forbidden: Source account is inactive." });
    }

    const existing = await findExistingTransaction(tx, {
      idempotency_key,
      transaction_type: "withdrawal",
      internal_account_id: account.id,
      amount: requested_amount.neg(),
    });
    if (existing) {
      return json(200, {
        status: "Withdrawal already processed (idempotency key found).",
      });
    }

    const ok = await tx.internalAccount.updateMany({
      where: { id: account.id, balance: { gte: requested_amount } },
      data: { balance: { decrement: requested_amount } },
    });

    if (ok.count !== 1) {
      await createDeniedTransaction(tx, {
        internal_account_id: account.id,
        amount: requested_amount.neg(),
        transaction_type: "withdrawal",
        direction: "outbound",
        idempotency_key,
      });
      return json(409, { error: "Conflict: Insufficient funds." });
    }

    const result = await createApprovedTransaction(
      tx,
      {
        internal_account_id: account.id,
        amount: requested_amount.neg(),
        transaction_type: "withdrawal",
        direction: "outbound",
        idempotency_key,
      },
      "Withdrawal already processed",
    );

    return json(200, {
      status: result.duplicate ? result.message : "Withdrawal successful.",
    });
  });
}

async function handleBillPay(
  prisma: ReturnType<typeof getPrisma>,
  request_body: z.infer<typeof Billpay>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: any,
  idempotency_key?: string | null,
) {
  const { bill_pay_rule_id } = request_body;

  return await prisma.$transaction(async (tx) => {
    const rule = await tx.billPayRule.findUnique({
      where: { id: bill_pay_rule_id },
      include: { user: true, source_internal: { include: { user: true } } },
    });

    if (
      !rule ||
      !auth?.supabaseUser ||
      rule.user.auth_user_id !== auth.supabaseUser.id
    ) {
      return json(404, { error: "Bill pay rule not found." });
    }

    const source = rule.source_internal;
    if (!source || source.user.auth_user_id !== auth.supabaseUser.id) {
      return json(404, { error: "Payer account not found." });
    }

    if (!source.is_active) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "billpay",
        direction: "outbound",
        bill_pay_rule_id: rule.id,
        idempotency_key,
      });
      return json(403, { error: "Forbidden: Source account is inactive." });
    }

    const payee = await tx.billPayPayee.findUnique({
      where: { id: rule.payee_id },
    });
    if (!payee || !payee.is_active) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "billpay",
        direction: "outbound",
        bill_pay_rule_id: rule.id,
        idempotency_key,
      });
      return json(403, { error: "Forbidden: Payee is inactive." });
    }

    const existing = await findExistingTransaction(tx, {
      idempotency_key,
      transaction_type: "billpay",
      internal_account_id: source.id,
      amount: rule.amount.neg(),
      bill_pay_rule_id: rule.id,
    });
    if (existing) {
      return json(200, {
        status:
          "Bill pay transaction already processed (idempotency key found).",
      });
    }

    // Simulate external payment (TO-DO: Create mock external payment gateway)
    const paymentSuccess = true;
    if (!paymentSuccess) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "billpay",
        direction: "outbound",
        bill_pay_rule_id: rule.id,
        idempotency_key,
      });
      return json(502, { error: "Bad Gateway: External payment failed." });
    }

    const ok = await tx.internalAccount.updateMany({
      where: { id: source.id, balance: { gte: rule.amount } },
      data: { balance: { decrement: rule.amount } },
    });

    if (ok.count !== 1) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "billpay",
        direction: "outbound",
        bill_pay_rule_id: rule.id,
        idempotency_key,
      });
      return json(409, { error: "Conflict: Insufficient funds." });
    }

    const result = await createApprovedTransaction(
      tx,
      {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "billpay",
        direction: "outbound",
        bill_pay_rule_id: rule.id,
        idempotency_key,
      },
      "Bill pay transaction already processed",
    );

    return json(200, {
      status: result.duplicate ? result.message : "Bill pay successful.",
    });
  });
}

async function handleInternalTransfer(
  prisma: ReturnType<typeof getPrisma>,
  request_body: z.infer<typeof InternalTransfer>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: any,
  idempotency_key?: string | null,
) {
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

    if (
      !rule ||
      !auth?.supabaseUser ||
      rule.user.auth_user_id !== auth.supabaseUser.id
    ) {
      return json(404, { error: "Transfer rule not found." });
    }

    const source = rule.source_internal;
    const destination = rule.destination_internal;

    if (!source || source.user.auth_user_id !== auth.supabaseUser.id) {
      return json(404, { error: "Source account not found." });
    }

    if (!destination) {
      return json(404, { error: "Destination account not found." });
    }

    if (!source.is_active) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "internal_transfer",
        direction: "outbound",
        transfer_rule_id: rule.id,
        idempotency_key,
      });
      return json(403, { error: "Forbidden: Source account is inactive." });
    }

    if (!destination.is_active) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "internal_transfer",
        direction: "outbound",
        transfer_rule_id: rule.id,
        idempotency_key,
      });
      return json(403, {
        error: "Forbidden: Destination account is inactive.",
      });
    }

    const existing = await findExistingTransaction(tx, {
      idempotency_key,
      transaction_type: "internal_transfer",
      internal_account_id: source.id,
      amount: rule.amount.neg(),
      transfer_rule_id: rule.id,
    });
    if (existing) {
      return json(200, {
        status: "Internal transfer already processed (idempotency key found).",
      });
    }

    const ok = await tx.internalAccount.updateMany({
      where: { id: source.id, balance: { gte: rule.amount } },
      data: { balance: { decrement: rule.amount } },
    });

    if (ok.count !== 1) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "internal_transfer",
        direction: "outbound",
        transfer_rule_id: rule.id,
        idempotency_key,
      });
      return json(409, {
        error: "Conflict: Insufficient funds in source account.",
      });
    }

    await tx.internalAccount.update({
      where: { id: destination.id },
      data: { balance: { increment: rule.amount } },
    });

    await createApprovedTransaction(
      tx,
      {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "internal_transfer",
        direction: "outbound",
        transfer_rule_id: rule.id,
        idempotency_key,
      },
      "Internal transfer already processed",
    );

    // Create inbound transaction with unique idempotency key
    await tx.transaction.create({
      data: {
        internal_account_id: destination.id,
        amount: rule.amount,
        transaction_type: "internal_transfer",
        direction: "inbound",
        status: "approved",
        transfer_rule_id: rule.id,
        idempotency_key: idempotency_key ? `${idempotency_key}-inbound` : null,
      },
    });

    return json(200, { status: "Internal transfer successful." });
  });
}

async function handleExternalOutbound(
  prisma: ReturnType<typeof getPrisma>,
  request_body: z.infer<typeof ExternalOutbound>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: any,
  idempotency_key?: string | null,
) {
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

    if (
      !rule ||
      !auth?.supabaseUser ||
      rule.user.auth_user_id !== auth.supabaseUser.id
    ) {
      return json(404, { error: "Transfer rule not found." });
    }

    const source = rule.source_internal;
    if (!source || source.user.auth_user_id !== auth.supabaseUser.id) {
      return json(404, { error: "Source account not found." });
    }

    if (!source.is_active) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "external_transfer",
        direction: "outbound",
        transfer_rule_id: rule.id,
        idempotency_key,
      });
      return json(403, { error: "Forbidden: Source account is inactive." });
    }

    const existing = await findExistingTransaction(tx, {
      idempotency_key,
      transaction_type: "external_transfer",
      internal_account_id: source.id,
      amount: rule.amount.neg(),
      transfer_rule_id: rule.id,
    });
    if (existing) {
      return json(200, {
        status: "External transfer already processed (idempotency key found).",
      });
    }

    // Simulate external payment (TO-DO: Create mock external payment gateway)
    const paymentSuccess = true;
    if (!paymentSuccess) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "external_transfer",
        direction: "outbound",
        transfer_rule_id: rule.id,
        idempotency_key,
      });
      return json(502, { error: "Bad Gateway: External payment failed." });
    }

    const ok = await tx.internalAccount.updateMany({
      where: { id: source.id, balance: { gte: rule.amount } },
      data: { balance: { decrement: rule.amount } },
    });

    if (ok.count !== 1) {
      await createDeniedTransaction(tx, {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "external_transfer",
        direction: "outbound",
        transfer_rule_id: rule.id,
        idempotency_key,
      });
      return json(409, {
        error: "Conflict: Insufficient funds in source account.",
      });
    }

    const result = await createApprovedTransaction(
      tx,
      {
        internal_account_id: source.id,
        amount: rule.amount.neg(),
        transaction_type: "external_transfer",
        direction: "outbound",
        transfer_rule_id: rule.id,
        idempotency_key,
      },
      "External transfer already processed",
    );

    return json(200, {
      status: result.duplicate
        ? result.message
        : "External transfer from internal account successful.",
    });
  });
}

async function handleExternalInbound(
  prisma: ReturnType<typeof getPrisma>,
  request_body: z.infer<typeof ExternalInbound>,
  idempotency_key?: string | null,
) {
  const { destination_account_number, requested_amount } = request_body;

  return await prisma.$transaction(async (tx) => {
    const account = await tx.internalAccount.findUnique({
      where: { account_number: destination_account_number },
      include: { user: true },
    });

    if (!account) {
      return json(404, { error: "Destination account not found." });
    }

    if (!account.is_active) {
      await createDeniedTransaction(tx, {
        internal_account_id: account.id,
        amount: requested_amount,
        transaction_type: "external_transfer",
        direction: "inbound",
        idempotency_key,
      });
      return json(403, {
        error: "Forbidden: Destination account is inactive.",
      });
    }

    const existing = await findExistingTransaction(tx, {
      idempotency_key,
      transaction_type: "external_transfer",
      internal_account_id: account.id,
      amount: requested_amount,
    });
    if (existing) {
      return json(200, {
        status: "External transfer already processed (idempotency key found).",
      });
    }

    await tx.internalAccount.update({
      where: { id: account.id },
      data: { balance: { increment: requested_amount } },
    });

    const result = await createApprovedTransaction(
      tx,
      {
        internal_account_id: account.id,
        amount: requested_amount,
        transaction_type: "external_transfer",
        direction: "inbound",
        idempotency_key,
      },
      "External transfer already processed",
    );

    return json(200, {
      status: result.duplicate
        ? result.message
        : "External transfer to internal account successful.",
    });
  });
}

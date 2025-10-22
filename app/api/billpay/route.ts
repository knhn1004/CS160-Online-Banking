import { z } from "zod";
import { Amount } from "../transactions/route";
import { Prisma } from "@prisma/client";
import { getAuthUserFromRequest } from "../../../lib/auth";
import { getPrisma } from "../../lib/prisma";
import type {
  BillPayPayee,
  BillPayRule as DBBillPayRule,
  InternalAccount,
} from "@prisma/client";

type AmountType = z.infer<typeof Amount>;

/* -------------------------------------------------------- Schema Helpers -------------------------------------------------------------- */

// Define BillPayRule structure:
export const BillPayRule = z
  .object({
    id: z.number().int().positive().optional(), // This is optional when a bill pay rule is being created, but required if we're updating a bill pay rule.
    user_id: z.number().int().min(1),
    source_internal_id: z.number().int().positive(),
    payee_id: z.number().int().positive(),
    amount: Amount,
    frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "yearly"]),
    start_time: z.iso.datetime(),
    end_time: z.iso.datetime().optional(),
  })
  .refine(
    (r: z.infer<typeof BillPayRule>) => {
      // Validate that the start & end times make sense.

      if (!r.end_time) {
        return true;
      }

      return new Date(r.start_time).getTime() < new Date(r.end_time).getTime();
    },
    { message: "start_time must be before end_time" },
  );

// Compile-time check:
export type BillPayRuleType = z.infer<typeof BillPayRule>;

// For bill pay, we want to support:

// (1) Creating bill pay rules.
export const CreateBillPayRule = BillPayRule.omit({ id: true }).extend({
  // Coerce common string inputs (OPTIONAL GUARD)
  user_id: z.coerce.number().int().positive(),
  source_internal_id: z.coerce.number().int().positive(),
  payee_id: z.coerce.number().int().positive(),
  amount: Amount,
  start_time: z.preprocess(
    (v: unknown) => (typeof v === "string" ? v : String(v)),
    z.iso.datetime(),
  ),
  end_time: z.preprocess(
    (v: unknown) =>
      v == null ? undefined : typeof v === "string" ? v : String(v),
    z.iso.datetime().optional(),
  ),
});

export type CreateBillPayRuleType = z.infer<typeof CreateBillPayRule>;

// (2) Updating bill pay rules.
export const UpdateBillPayRule = BillPayRule.partial().extend({
  id: z.number().int().positive(),
});

export type UpdateBillPayRuleType = z.infer<typeof UpdateBillPayRule>;

// (3) Deleting bill pay rules (doesn't need definition).
// (4) Retrieving bill pay rules (doesn't need definition).

const prisma = getPrisma();

type RuleWithRelations = DBBillPayRule & {
  payee?: BillPayPayee | null;
  source_internal?: InternalAccount | null;
};

/* ------------------------------------------------ Verification & Validation Helpers ------------------------------------------------ */

// Function that gets if the user ID.
export async function getUserIdFromRequest(
  req: Request,
): Promise<number | null> {
  const auth = await getAuthUserFromRequest(req);

  if (!auth?.ok || !auth.supabaseUser?.id) {
    return null;
  }

  const supabase_id = auth.supabaseUser.id;

  // Look up the application user by their Supabase ID:
  try {
    const app_user = await prisma.user.findUnique({
      where: { auth_user_id: supabase_id },
      select: { id: true },
    });

    // If the user cannot be found, return null.
    if (!app_user) {
      return null;
    } else {
      return app_user.id;
    }
  } catch (err: unknown) {
    console.error("getUserIdFromRequest error", err);
    return null;
  }
}

// Function that checks if the payee exists (by getting them via ID).
export async function getPayeeById(
  payee_id: number,
): Promise<BillPayPayee | null> {
  try {
    return await prisma.billPayPayee.findUnique({
      where: { id: payee_id },
    });
  } catch (err: unknown) {
    console.error("getPayeeById error", err);
    return null;
  }
}

// Function that checks if the payee's account is active.
export async function isPayeeActive(payee_id: number): Promise<boolean> {
  try {
    const payee = await prisma.billPayPayee.findUnique({
      where: { id: payee_id },
      select: { id: true, is_active: true },
    });
    return !!payee; // Explicit boolean coercion.
  } catch (err: unknown) {
    console.error("isPayeeActive error", err);
    return false;
  }
}

// Function that checks if the internal source account exists and is still active.
export async function isInternalAccountActive(
  source_internal_id: number,
): Promise<boolean> {
  try {
    const account = await prisma.internalAccount.findUnique({
      where: { id: source_internal_id },
      select: { is_active: true },
    });
    return !!account?.is_active;
  } catch (err: unknown) {
    console.error("isInternalAccountActive error", err);
    return false;
  }
}

// Function that checks if the internal source account has sufficient balance.
export async function hasSufficientBalance(
  source_internal_id: number,
  amount: AmountType,
): Promise<{ ok: boolean; balance: string | null }> {
  try {
    type AccountBalanceRow = {
      balance: Prisma.Decimal | number | string | null;
    };
    const account = (await prisma.internalAccount.findUnique({
      where: { id: source_internal_id },
      select: { balance: true },
    })) as AccountBalanceRow | null;

    if (!account || account.balance == null) {
      return {
        ok: false,
        balance: null,
      };
    }

    // Coerce payment amount to a decimal.
    const requested_amount = new Prisma.Decimal(String(amount));
    const current_balance = new Prisma.Decimal(String(account.balance));

    const ok = current_balance.gte(requested_amount);

    // Return the balance as a string to preserve precision.
    return { ok, balance: current_balance.toString() };
  } catch (err: unknown) {
    console.error("hasSufficientBalance error", err);
    return { ok: false, balance: null };
  }
}
/* ------------------------------------------- Scheduler Helpers ---------------------------------------------------------------- */

function computeNextRunFromStart(start_iso: string, frequency: string): Date {
  const parsed = new Date(start_iso);
  if (isNaN(parsed.getTime())) {
    return parsed;
  }

  const now = new Date();
  const date = new Date(parsed);

  while (date <= now) {
    if (frequency === "weekly") {
      date.setDate(date.getDate() + 7);
    } else if (frequency === "biweekly") {
      date.setDate(date.getDate() + 14);
    } else if (frequency === "monthly") {
      date.setMonth(date.getMonth() + 1);
    } else if (frequency === "quarterly") {
      date.setMonth(date.getMonth() + 3);
    } else if (frequency === "yearly") {
      date.setFullYear(date.getFullYear() + 1);
    }
  }
  return date;
}

/* ------------------------------------------------ API ------------------------------------------------------------------------- */

// Bill pay POST handler:
export async function POST(request: Request) {
  try {
    const raw_body = await request.json();
    const parsed_body = CreateBillPayRule.safeParse(raw_body);

    if (!parsed_body.success) {
      return new Response(
        JSON.stringify({
          error: "Parsing failed.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = parsed_body.data as CreateBillPayRuleType;

    // Authentication (map the Supabase user ID to the application user ID):
    const application_user_id = await getUserIdFromRequest(request);

    if (!application_user_id) {
      return new Response(
        JSON.stringify({
          error: "Unauthenticated user.",
        }),
        {
          status: 401,
        },
      );
    }

    if (application_user_id !== data.user_id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden access.",
        }),
        {
          status: 400,
        },
      );
    }

    // Referential checks:
    const payee = await getPayeeById(data.payee_id);

    if (!payee) {
      return new Response(
        JSON.stringify({
          error: "Payee not found.",
        }),
        {
          status: 400,
        },
      );
    }

    const active_account = await isInternalAccountActive(
      data.source_internal_id,
    );

    if (!active_account) {
      return new Response(
        JSON.stringify({
          error: "Source account is inactive.",
        }),
        {
          status: 400,
        },
      );
    }

    // Need to verify that the source account belongs to the user too:
    const account_owner = await prisma.internalAccount.findFirst({
      where: {
        id: data.source_internal_id,
        user_id: application_user_id,
      },
      select: {
        id: true,
        account_number: true,
      },
    });

    if (!account_owner) {
      return new Response(
        JSON.stringify({
          error: "Source account not found or not owned by user.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Create bill pay rule w/ scheduler calculations:
    const parsed_start = new Date(data.start_time);
    if (isNaN(parsed_start.getTime())) {
      return new Response(
        JSON.stringify({
          error: "Invalid start_time.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const initial_next_run = computeNextRunFromStart(
      data.start_time,
      data.frequency,
    );
    const bill_pay_rule = await prisma.billPayRule.create({
      data: {
        user_id: data.user_id,
        source_internal_id: data.source_internal_id,
        payee_id: data.payee_id,
        amount: new Prisma.Decimal(String(data.amount)),
        frequency: data.frequency,
        start_time: new Date(data.start_time),
        end_time: data.end_time ? new Date(data.end_time) : null,
        next_run: initial_next_run,
      },
      include: { payee: true, source_internal: true },
    });

    return new Response(
      JSON.stringify({
        message: "Created",
        rule: bill_pay_rule,
      }),
      {
        status: 201,
      },
    );
  } catch (err: unknown) {
    console.error("POST /api/billpay error", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
      },
    );
  }
}

// Bill pay PUT handler:
export async function PUT(request: Request) {
  try {
    const raw_body = await request.json();
    const parsed = UpdateBillPayRule.safeParse(raw_body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Parsing failed.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = parsed.data as UpdateBillPayRuleType;

    if (!data.id) {
      return new Response(
        JSON.stringify({
          error: "ID required for update.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Update rule should only change the amount and frequency, any other major changes will require deleting the rule and creating a new one instead!
    const allowed = new Set(["id", "amount", "frequency"]);
    const attempted =
      raw_body && typeof raw_body === "object"
        ? Object.keys(raw_body as Record<string, unknown>)
        : [];
    const disallowed = attempted.filter((k) => !allowed.has(k));

    if (disallowed.length > 0) {
      return new Response(
        JSON.stringify({
          error:
            "Only 'amount' and 'frequency' can be updated. Delete and recreate the rule to change other fields.",
          disallowed_fields: disallowed,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Check to see that the user ID was provided (authentication).
    const application_user_id = await getUserIdFromRequest(request);

    if (!application_user_id) {
      return new Response(
        JSON.stringify({
          error: "Unauthenticated user",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Check to see that the rule we're trying to modify still exists within database.
    const existing_rule = await prisma.billPayRule.findUnique({
      where: { id: data.id },
    });

    if (!existing_rule) {
      return new Response(
        JSON.stringify({ error: "Bill pay rule not found." }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Check to see that the rule we're trying to modify belongs to the user trying to modify it.
    if (existing_rule.user_id !== application_user_id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden access.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const update_data: Prisma.BillPayRuleUpdateInput = {};

    // Validity checks for any updated fields:
    // Update payment amount.
    if (data.amount !== undefined) {
      update_data.amount = new Prisma.Decimal(String(data.amount));
    }

    // Update payment frequency.
    if (data.frequency !== undefined) {
      update_data.frequency = data.frequency;

      // Recompute next_run using existing start_time.
      const startIso = (existing_rule.start_time as Date).toISOString();
      const computed = computeNextRunFromStart(startIso, data.frequency);

      if (
        existing_rule.end_time &&
        computed > (existing_rule.end_time as Date)
      ) {
        update_data.next_run = null;
      } else {
        update_data.next_run = computed;
      }
    }

    // If nothing relevant is updated, return 400.
    if (Object.keys(update_data).length === 0) {
      return new Response(
        JSON.stringify({
          error: "No updatable fields provided.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const updated = await prisma.billPayRule.update({
      where: { id: data.id },
      data: update_data,
      include: { payee: true, source_internal: true },
    });

    return new Response(
      JSON.stringify({
        message: "Updated payment rule.",
        rule: updated,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    console.error("PUT /api/billpay error", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Bill pay DELETE handler:
export async function DELETE(request: Request) {
  try {
    // We only need the payment rule ID, no JSON body is necessary.
    const url = new URL(request.url);

    // Check that the rule ID is passed in:
    const id_parameter = url.searchParams.get("id");
    if (!id_parameter) {
      return new Response(
        JSON.stringify({
          error: "Rule ID is required to delete.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Check that the rule ID is valid:
    const id = Number(id_parameter);
    if (Number.isNaN(id) || id <= 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid ID.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Authenticate the user attempting to delete bill pay rule:
    const application_user_id = await getUserIdFromRequest(request);
    if (!application_user_id) {
      return new Response(JSON.stringify({ error: "Unauthenticated user." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existing_rule = await prisma.billPayRule.findUnique({
      where: { id },
    });
    if (!existing_rule) {
      return new Response(
        JSON.stringify({
          error: "Bill pay rule not found.",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (existing_rule.user_id !== application_user_id) {
      return new Response(
        JSON.stringify({
          error: "Forbidden access.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Hard delete from database:
    await prisma.billPayRule.delete({
      where: { id: existing_rule.id },
    });
    return new Response(
      JSON.stringify({
        message: "Deleted bill pay rule.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    console.error("DELETE /api/billpay error", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Bill pay GET handler:
// This handler allows a user to pass in a business's name to find associated rules.
// Also only requires a URL with the name as a query parameter.
export async function GET(request: Request) {
  try {
    // Check that the user is authenticated by Supabase.
    const application_user_id = await getUserIdFromRequest(request);
    if (!application_user_id) {
      return new Response(
        JSON.stringify({
          error: "Unauthenticated user.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const url = new URL(request.url);

    // Check if the search query parameter has been passed in:
    const payee_name = url.searchParams.get("payee");

    const where: Prisma.BillPayRuleWhereInput = {
      user_id: application_user_id,
    };

    // If query parameter has been passed in, we return matching rules associated w/ user.
    // Case-insensitive filtering!
    if (payee_name) {
      where.payee = {
        business_name: { contains: payee_name, mode: "insensitive" },
      };
    }

    const rules = await prisma.billPayRule.findMany({
      where,
      include: { payee: true, source_internal: true },
      orderBy: { next_run: "asc" },
    });

    // Serialize fields to strings for JSON safety.
    // Bill pay display to the user should only include the following fields:
    // (1) Bill pay rule ID.
    // (2) Payee's business name.
    // (3) Frequency of payment.
    // (4) Amount per payment.
    // (5) Rule creation date.
    // (6) Rule end date.
    // (7) Source account number.
    const serialized = rules.map((r: RuleWithRelations) => ({
      id: r.id,
      payee_business_name: r.payee?.business_name ?? null,
      frequency: r.frequency,
      amount: r.amount?.toString?.() ?? null,
      last_run: r.last_run ? (r.last_run as Date).toISOString() : null,
      next_run: r.next_run ? (r.next_run as Date).toISOString() : null,
      rule_start: r.start_time ? (r.start_time as Date).toISOString() : null,
      rule_end: r.end_time ? (r.end_time as Date).toISOString() : null,
      internal_account_number: r.source_internal?.account_number ?? null,
    }));

    return new Response(
      JSON.stringify({
        rules: serialized,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    console.error("GET /api/billpay error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

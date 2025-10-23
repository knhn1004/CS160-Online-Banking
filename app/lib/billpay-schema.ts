import { z } from "zod";
import { Amount } from "../api/transactions/route";

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

export type AmountType = z.infer<typeof Amount>;

/* ------------------------------------------- Scheduler Helpers ---------------------------------------------------------------- */

export function computeNextRunFromStart(
  start_iso: string,
  frequency: string,
): Date {
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

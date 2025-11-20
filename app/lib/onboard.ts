import { z } from "zod";
import { getPrisma } from "@/app/lib/prisma";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileDraft = Record<string, unknown>;
type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { profileDraft?: ProfileDraft } | null;
};
type GetUserResult = {
  data?: { user?: AuthUser } | null;
  error?: { message?: string } | null;
};
type UpdateUserResult = { data?: unknown; error?: { message?: string } | null };
type AuthHelpers = {
  getUser?: () => Promise<GetUserResult>;
  updateUser?: (args: {
    data?: Record<string, unknown>;
  }) => Promise<UpdateUserResult>;
};
const prisma = getPrisma();

const US_STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "PR",
  "GU",
  "VI",
  "AS",
  "MP",
] as const;

const ROLE_VALUES = ["customer", "bank_manager"] as const;

const ProfileDraftSchema = z.object({
  username: z.string().min(3),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  streetAddress: z.string().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().min(1),
  stateOrTerritory: z.enum([...US_STATE_CODES] as unknown as [
    string,
    ...string[],
  ]),
  postalCode: z.string().min(5),
  country: z.string().optional(),
  role: z.enum([...ROLE_VALUES] as [string, ...string[]]).optional(),
});

export async function finalizeOnboardFromSupabaseUser(
  supabase: SupabaseClient,
) {
  try {
    const auth = supabase.auth as unknown as AuthHelpers;
    const getUserResult = (await auth.getUser?.()) ?? {
      data: null,
      error: null,
    };
    if (getUserResult.error)
      return {
        ok: false,
        reason: "supabase_get_user_error",
        error: getUserResult.error,
      };
    const user = (getUserResult.data && getUserResult.data.user) ?? null;
    if (!user) return { ok: false, reason: "no_user" };

    // if profile already exists, treat as success
    const existing = await prisma.user.findUnique({
      where: { auth_user_id: user.id },
    });
    if (existing) {
      try {
        const auth = supabase.auth as unknown as AuthHelpers;
        await auth.updateUser?.({ data: { profileDraft: null } });
      } catch {}
      return { ok: true };
    }

    const draft = user.user_metadata?.profileDraft ?? null;
    if (!draft) return { ok: false, reason: "no_profile_draft" };

    const parse = ProfileDraftSchema.safeParse(draft);
    if (!parse.success)
      return {
        ok: false,
        reason: "invalid_draft",
        details: parse.error.issues,
      };

    const p = parse.data;

    const normalizePhone = (input?: string): string | null => {
      if (!input) return null;
      const digits = input.replace(/\D/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      return null;
    };

    const phoneNumber = normalizePhone(p.phoneNumber ?? "");
    if (!phoneNumber) return { ok: false, reason: "invalid_phone" };

    const rawState = String(p.stateOrTerritory ?? "");
    if (!US_STATE_CODES.includes(rawState as (typeof US_STATE_CODES)[number])) {
      return { ok: false, reason: "invalid_state" };
    }
    const stateOrTerritoryValue = rawState as (typeof US_STATE_CODES)[number];

    const rawRole = String(p.role ?? "customer");
    const roleValue = (ROLE_VALUES as readonly string[]).includes(rawRole)
      ? (rawRole as (typeof ROLE_VALUES)[number])
      : ("customer" as (typeof ROLE_VALUES)[number]);

    // Idempotent upsert (ensure UNIQUE constraint on auth_user_id)
    await prisma.user.upsert({
      where: { auth_user_id: user.id },
      create: {
        username: String(p.username),
        auth_user_id: user.id,
        first_name: String(p.firstName),
        last_name: String(p.lastName),
        email: String(p.email ?? user.email ?? ""),
        phone_number: phoneNumber,
        street_address: String(p.streetAddress ?? ""),
        address_line_2: p.addressLine2 ?? null,
        city: String(p.city),
        state_or_territory: stateOrTerritoryValue,
        postal_code: String(p.postalCode),
        country: String(p.country ?? "United States"),
        role: roleValue,
      },
      update: {}, // no-op to keep idempotent
    });

    try {
      await auth.updateUser?.({ data: { profileDraft: null } });
    } catch {}

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

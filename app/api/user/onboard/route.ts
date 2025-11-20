import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";
import { z } from "zod";

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

// Thin validation for the draft (adjust to match SignupSchema):
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

// Define a minimal supabase user shape we need (avoid `any`)
type SupabaseUser = {
  id: string;
  user_metadata?: {
    profileDraft?: unknown;
  } | null;
};

export async function POST() {
  // Only read from HttpOnly cookies.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = (data as { user?: SupabaseUser | null })?.user ?? null;
  if (!user)
    return NextResponse.json(
      { error: "Unauthorized." },
      {
        status: 401,
      },
    );

  // Check user onboard status early:
  const existing = await prisma.user.findUnique({
    where: { auth_user_id: user.id },
  });
  if (existing) {
    // Clear profileDraft server-side after successful write:
    try {
      await supabase.auth.updateUser?.({ data: { profileDraft: null } });
    } catch {
      // Ignore non-critical failures.
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Build draft from user metadata.
  const draft = user.user_metadata?.profileDraft ?? null;
  if (!draft) {
    return NextResponse.json(
      { error: "No profile draft available." },
      {
        status: 400,
      },
    );
  }

  // Validate draft.
  const parse = ProfileDraftSchema.safeParse(draft);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid draft.", details: parse.error.issues },
      {
        status: 400,
      },
    );
  }

  const p = parse.data;

  // Normalize values so that they match Prisma expectations:
  const normalizePhone = (input?: string): string | null => {
    if (!input) return null;
    const digits = input.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  };

  const phoneNumber = normalizePhone(p.phoneNumber ?? "");
  if (!phoneNumber) {
    return NextResponse.json(
      { error: "Invalid or missing phone number." },
      { status: 400 },
    );
  }
  const normalizedPhoneNumber = phoneNumber;

  // Narrow state to the literal union used in app:
  const rawState = String(p.stateOrTerritory ?? "");
  if (!US_STATE_CODES.includes(rawState as (typeof US_STATE_CODES)[number])) {
    return NextResponse.json(
      { error: "Invalid state/territory." },
      { status: 400 },
    );
  }
  const stateOrTerritoryValue = rawState as (typeof US_STATE_CODES)[number];

  // Narrow role to the RoleEnum (default is "customer"):
  const rawRole = String(p.role ?? "customer");
  const roleValue = (ROLE_VALUES as readonly string[]).includes(rawRole)
    ? (rawRole as (typeof ROLE_VALUES)[number])
    : ("customer" as (typeof ROLE_VALUES)[number]);

  // Coerce other required strings so TS sees concrete string types:
  const streetAddress = String(p.streetAddress ?? "");
  const city = String(p.city ?? "");
  const postalCode = String(p.postalCode ?? "");
  const country = String(p.country ?? "United States");

  // Insert into DB using Prisma (NOT Supabase). This needs to be idempotent.
  // TO-DO: Change to upsert instead of createMany (think this is optional though).
  try {
    const result = await prisma.user.createMany({
      data: [
        {
          username: String(p.username),
          auth_user_id: user.id,
          first_name: String(p.firstName),
          last_name: String(p.lastName),
          email: String(p.email),
          phone_number: normalizedPhoneNumber,
          street_address: streetAddress,
          address_line_2: p.addressLine2 ?? null,
          city,
          state_or_territory: stateOrTerritoryValue,
          postal_code: postalCode,
          country,
          role: roleValue,
        },
      ],
      skipDuplicates: true,
    });

    // If count === 0, then a duplicate prevented creation. This is a success.
    if (result.count === 0) {
      // Clear profileDraft server-side after successful write:
      try {
        await supabase.auth.updateUser?.({ data: { profileDraft: null } });
      } catch {
        // Ignore non-critical failures.
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Clear profileDraft server-side after successful write:
    try {
      await supabase.auth.updateUser?.({ data: { profileDraft: null } });
    } catch {
      // Ignore non-critical failures.
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (prismaErr: unknown) {
    if (prismaErr instanceof Error) {
      console.error("Prisma create user error:", prismaErr.message);
    } else {
      console.error("Prisma create user error:", prismaErr);
    }
    return new NextResponse("Failed to create profile", { status: 500 });
  }
}

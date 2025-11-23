// api/user/onboard/route.ts assumes that the user in question has already been authenticated.
// This endpoint handles writing profile fields to the database.
// REMOVE THIS ENDPOINT IF SERVER ACTIONS IS ACCEPTED.
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";
import { SignupSchema } from "@/lib/schemas/user";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

function isPrismaClientKnownRequestError(
  e: unknown,
): e is Prisma.PrismaClientKnownRequestError {
  return typeof e === "object" && e !== null && "code" in e;
}

const prisma = getPrisma();

// Even though user_metadata is ideally validated earlier by both the client and by our signup endpoint, we want to guard anyways.
// We can reuse schemas to simplify our code.
const ProfileDraftSchema = SignupSchema.omit({
  password: true,
  confirmPassword: true,
});

// We also want to normalize what goes into the database (specifically, phone number).
const NormalizedProfileSchema = ProfileDraftSchema.extend({
  // Normalized phone number example: "+1XXXXXXXXXX".
  phoneNumber: z.preprocess(
    (val) => {
      if (typeof val !== "string") return val; // This allows null/undefined phone numbers.
      const digits = val.replace(/\D/g, "");
      if (digits.length === 10) return `+1${digits}`; // Assumes U.S. phone numbers ONLY.
      // Not sure if this is needed but it's just in case a user inputs a 1 in front of the number.
      // Technically form submission will NOT allow this input.
      if (digits.length === 11 && digits.startsWith("1"))
        return `+1${digits.slice(-10)}`;
      return val; // Validator will reject later.
    },
    z
      .string()
      .regex(/^\+1\d{10}$/, { message: "Invalid U.S. phone number." })
      .nullable()
      .optional(),
  ),
});

export async function POST() {
  // Only read from HttpOnly cookies.
  // Create Supabase server-side client.
  const supabase = await createClient();

  // Exact return shapes.
  type GetUserReturn = Awaited<ReturnType<typeof supabase.auth.getUser>>;
  type UserFromGetUser = GetUserReturn["data"]["user"];

  // Get authenticated user from Supabase, or else return error.
  const getUserRet = await supabase.auth.getUser();
  const user: UserFromGetUser = getUserRet.data?.user ?? null;
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      {
        status: 401,
      },
    );
  }

  // For idempotency, we should check the user's onboarding status early.
  const existing = await prisma.user.findUnique({
    where: { auth_user_id: user.id },
  });
  if (existing) {
    // Clear profileDraft server-side if user already exists.
    try {
      await supabase.auth.updateUser?.({ data: { profileDraft: null } });
    } catch (err) {
      // Ignore non-critical failures.
      console.debug("[onboard] failed to clear profileDraft", {
        authUserId: user.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Build draft from user metadata. If this is not possible, we cannot proceed.
  const draft = user.user_metadata?.profileDraft ?? null;
  if (!draft) {
    console.debug("[onboard] no profileDraft in user_metadata", {
      authUserId: user.id,
    });
    return NextResponse.json(
      { error: "No profile draft available." },
      {
        status: 400,
      },
    );
  }

  // Validate draft.
  const parsed = NormalizedProfileSchema.safeParse(draft);
  if (!parsed.success) {
    console.debug("[onboard] invalid profileDraft.", {
      authUserId: user.id,
      issues: parsed.error.issues,
    });
    return NextResponse.json(
      { error: "Invalid draft.", details: parsed.error.issues },
      {
        status: 400,
      },
    );
  }

  const p = parsed.data;

  // Upsert into DB using Prisma (NOT Supabase). This needs to be idempotent.
  try {
    await prisma.user.upsert({
      where: { auth_user_id: user.id },
      update: {}, // If the user already exists, we don't want to update anything.
      create: {
        username: String(p.username),
        auth_user_id: user.id,
        first_name: String(p.firstName),
        last_name: String(p.lastName),
        email: String(p.email),
        phone_number: String(p.phoneNumber ?? null),
        street_address: p.streetAddress ?? "",
        address_line_2: p.addressLine2 ?? null,
        city: p.city ?? "",
        state_or_territory: p.stateOrTerritory,
        postal_code: p.postalCode ?? "",
        country: "United States",
        role: "customer",
      },
    });

    // Clear profileDraft server-side after successful write:
    try {
      await supabase.auth.updateUser?.({ data: { profileDraft: null } });
    } catch (err) {
      // Ignore non-critical failures.
      console.debug("[onboard] failed to clear profileDraft.", {
        authUserId: user.id,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (prismaErr: unknown) {
    // Some fields in the database are unique, and so we need to guard against this case.
    // This is checked in the signup endpoint FIRST though, so this is a just-in-case.
    if (isPrismaClientKnownRequestError(prismaErr)) {
      if (prismaErr.code === "P2002") {
        const meta = prismaErr as { target?: string[] | string } | undefined;
        const target = Array.isArray(meta?.target)
          ? meta.target.join(",")
          : meta?.target;
        return NextResponse.json(
          {
            error: "Conflict",
            field: target ?? "unknown",
            message: "A record with that value already exists.",
          },
          { status: 409 },
        );
      }
    }

    // Fallback: log and return 500.
    console.error("[onboard] Prisma upsert failed", {
      authUserId: user?.id,
      message:
        prismaErr instanceof Error ? prismaErr.message : String(prismaErr),
      stack: prismaErr instanceof Error ? prismaErr.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to persist profile" },
      { status: 500 },
    );
  }
}

// This route exists to decouple the signup form submission from the signup form.
// That is, we want the submission to be part of a server component.
// REMOVE THIS ENDPOINT IF SERVER ACTIONS IS ACCEPTED.
import { NextResponse } from "next/server";
import { SignupSchema } from "@/lib/schemas/user";
import { createClient } from "@/utils/supabase/server";
import { getPrisma } from "@/app/lib/prisma";
import { z } from "zod";

const prisma = getPrisma();

// When the user submits, they send their form to this endpoint.
export async function POST(req: Request) {
  // Grab the form from the request body.
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Missing body." },
      {
        status: 400,
      },
    );
  }

  // Validate/parse the payload using our schema.
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.issues },
      {
        status: 400,
      },
    );
  }

  // Use the validated data (typed) from parsed.data
  type SignupPayload = z.infer<typeof SignupSchema>;
  const payload = parsed.data as SignupPayload;

  // Grab the fields from the parsed data. Note that this strips the password from the user_metadata.profileDraft!
  const { password, ...profile } = payload;

  // We need to make sure that the user doesn't input a duplicate field as another existing user.
  // That is, some DB fields are unique and we need to let user know during signup.
  const normalizedEmail = String(payload.email ?? "")
    .trim()
    .toLowerCase();
  const normalizePhone = (v?: string) => {
    if (!v) return null;
    const digits = v.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1"))
      return `+1${digits.slice(-10)}`;
    return null;
  };
  const normalizedPhone = normalizePhone(payload.phoneNumber ?? null);

  const conflict = await prisma.user.findFirst({
    where: {
      OR: [
        { username: String(payload.username ?? "") },
        { email: normalizedEmail },
        ...(normalizedPhone ? [{ phone_number: normalizedPhone }] : []),
      ],
    },
    select: { username: true, email: true, phone_number: true },
  });

  // We want the user to know what the issue with their forms are.
  if (conflict) {
    if (conflict.username === payload.username) {
      return NextResponse.json(
        { error: "Username taken", field: "username" },
        { status: 409 },
      );
    }
    if (conflict.email === normalizedEmail) {
      return NextResponse.json(
        { error: "Email already in use", field: "email" },
        { status: 409 },
      );
    }
    if (normalizedPhone && conflict.phone_number === normalizedPhone) {
      return NextResponse.json(
        { error: "Phone number already in use", field: "phoneNumber" },
        { status: 409 },
      );
    }

    // Generic fallback if we detected a conflict but couldn't match field precisely.
    return NextResponse.json(
      { error: "Conflict.", field: "unknown" },
      { status: 409 },
    );
  }

  // Create a Supabase server-side client to handle the creation of the auth user and attach user_metadata.profileDraft.
  const supabase = await createClient();

  // Narrowly type the admin auth helper instead of using `any`.
  type SupabaseAdminAuth = {
    admin: {
      createUser: (opts: {
        email: string;
        password?: string;
        user_metadata?: unknown;
      }) => Promise<{ data?: unknown; error?: { message?: string } }>;
    };
  };

  const admin = (supabase.auth as unknown as SupabaseAdminAuth).admin;
  const { error } = await admin.createUser({
    email: parsed.data.email,
    password,
    user_metadata: { profileDraft: profile },
  });

  if (error) {
    // If the auth user already exists, return 409.
    if (!/already exists/i.test(error.message ?? "")) {
      return NextResponse.json(
        { error: "Auth user already exists." },
        { status: 409 },
      );
    }
    // Any unexpected errors:
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Supabase auth user created successfully.
  return NextResponse.json({ ok: true, note: "Created" }, { status: 201 });
}

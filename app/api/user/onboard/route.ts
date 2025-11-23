import { z } from "zod";
import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { RoleEnum, USStateTerritory } from "@prisma/client";

type AuthSuccess = { ok: true; supabaseUser: { id: string; email?: string } };
type AuthFailure = { ok: false; status?: number; body?: unknown };
type AuthResult = AuthSuccess | AuthFailure;

const OnboardSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email({ message: "Invalid email address" }),
  phone_number: z
    .string()
    .regex(
      /^\+\d{10,15}$/,
      "Phone number must be in E.164 format (e.g. +11234567890)",
    ),
  street_address: z.string().min(1, "Street address is required"),
  address_line_2: z.string().nullable().optional(),
  city: z.string().min(1, "City is required"),
  state_or_territory: z.enum(
    Object.values(USStateTerritory) as unknown as [string, ...string[]],
  ),
  postal_code: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Postal code must be 5 digits or ZIP+4 format"),
  country: z.string().min(1),
  role: z.enum(Object.values(RoleEnum) as unknown as [string, ...string[]]),
});

export async function POST(request: Request) {
  try {
    // parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ message: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // validate payload
    const result = OnboardSchema.safeParse(body);
    if (!result.success) {
      console.error("Onboard validation failed:", result.error.issues);
      return new Response(
        JSON.stringify({
          message: "Validation failed",
          issues: result.error.issues,
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
    const safeData: z.infer<typeof OnboardSchema> = result.data;

    // require auth token from client and resolve auth_user_id
    const auth = (await getAuthUserFromRequest(request).catch(
      () => null,
    )) as AuthResult;
    const authUserId = auth.ok ? auth.supabaseUser.id : undefined;

    if (!authUserId) {
      return new Response(
        JSON.stringify({
          message:
            "Authentication required. Sign up/sign in on the client and include Authorization: Bearer <access_token> when POSTing to this endpoint.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // create user row (auth_user_id is required by Prisma)
    const prisma = getPrisma();
    const user = await prisma.user.create({
      data: {
        auth_user_id: authUserId,
        email: safeData.email,
        username: safeData.username,
        first_name: safeData.first_name,
        last_name: safeData.last_name,
        phone_number: safeData.phone_number,
        street_address: safeData.street_address,
        address_line_2: safeData.address_line_2 || null,
        city: safeData.city,
        state_or_territory: safeData.state_or_territory as USStateTerritory,
        postal_code: safeData.postal_code,
        country: safeData.country,
        role: safeData.role as RoleEnum,
      },
    });

    const { revalidatePath, revalidateTag } = await import("next/cache");
    await revalidateTag(`user-${authUserId}`);
    await revalidateTag(`profile-${authUserId}`);
    await revalidateTag(`user-${user.id}`);
    await revalidateTag(`profile-${user.id}`);
    await revalidatePath("/dashboard");
    await revalidatePath("/api/user/profile");

    return new Response(JSON.stringify({ user }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Onboard POST error:", err);
    return new Response(
      JSON.stringify({
        message: "Internal error",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

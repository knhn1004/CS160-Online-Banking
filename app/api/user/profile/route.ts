import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { USStateTerritory } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

// Configure route segment
export const dynamic = "force-dynamic"; // Always fetch fresh data
export const revalidate = 0; // Don't cache

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
  });

  if (!currentUser) {
    return new Response(JSON.stringify({ message: "User not onboarded" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }

  return new Response(JSON.stringify({ user: currentUser }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}

export async function PUT(request: Request) {
  const auth = await getAuthUserFromRequest(request);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      headers: { "Content-Type": "application/json" },
      status: auth.status,
    });
  }

  const currentUser = await getPrisma().user.findUnique({
    where: { auth_user_id: auth.supabaseUser.id },
  });

  if (!currentUser) {
    return new Response(JSON.stringify({ message: "User not onboarded" }), {
      headers: { "Content-Type": "application/json" },
      status: 404,
    });
  }

  const body = (await request.json()) as Record<string, unknown>;

  // Validate required fields
  const requiredFields = [
    "first_name",
    "last_name",
    "phone_number",
    "street_address",
    "city",
    "state_or_territory",
    "postal_code",
  ];

  for (const field of requiredFields) {
    if (!body[field]) {
      return new Response(
        JSON.stringify({ message: `Missing required field: ${field}` }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }
  }

  // Validate state_or_territory is a valid enum value
  if (
    !Object.values(USStateTerritory).includes(
      body.state_or_territory as USStateTerritory,
    )
  ) {
    return new Response(
      JSON.stringify({ message: "Invalid state or territory" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      },
    );
  }

  // Update user
  const updatedUser = await getPrisma().user.update({
    where: { id: currentUser.id },
    data: {
      first_name: body.first_name as string,
      last_name: body.last_name as string,
      phone_number: body.phone_number as string,
      street_address: body.street_address as string,
      address_line_2: (body.address_line_2 as string | undefined) || null,
      city: body.city as string,
      state_or_territory: body.state_or_territory as USStateTerritory,
      postal_code: body.postal_code as string,
    },
  });

  // Invalidate caches after update
  revalidatePath("/dashboard");
  revalidatePath("/api/user/profile");
  revalidateTag(`user-${currentUser.id}`);
  revalidateTag(`user-${auth.supabaseUser.id}`);

  return new Response(JSON.stringify({ user: updatedUser }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}

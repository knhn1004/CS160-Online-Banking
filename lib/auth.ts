import { createClient } from "@/utils/supabase/server";
import type { RoleEnum } from "@prisma/client";

export type AuthResult =
  | { ok: true; supabaseUser: { id: string; email?: string | null } }
  | { ok: false; status: number; body: { message: string } };

export type UserProfile = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleEnum;
  phone_number: string;
  street_address: string;
  address_line_2: string | null;
  city: string;
  state_or_territory: string;
  postal_code: string;
  country: string;
  created_at: Date;
};

export async function getAuthUserFromRequest(
  request: Request,
): Promise<AuthResult> {
  // Check for authorization header (case-insensitive)
  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");

  if (!authHeader) {
    return { ok: false, status: 401, body: { message: "Unauthorized" } };
  }

  // Extract bearer token
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return {
      ok: false,
      status: 401,
      body: { message: "Invalid authorization header format" },
    };
  }

  const token = bearerMatch[1];

  try {
    // Create Supabase client with the token in global headers for stateless auth
    const supabase = await createClient(authHeader);

    // Validate the token by getting the user
    // Pass token directly to getUser() for stateless auth (mobile apps)
    // Global headers alone may not be sufficient for getUser() in SSR
    const userResult = await supabase.auth.getUser(token);

    // Check for errors first
    if (userResult.error) {
      console.error("Auth error:", userResult.error.message);
      return {
        ok: false,
        status: 401,
        body: { message: userResult.error.message || "Unauthorized" },
      };
    }

    const { user } = userResult.data;
    if (!user) {
      return { ok: false, status: 401, body: { message: "Unauthorized" } };
    }

    return { ok: true, supabaseUser: { id: user.id, email: user.email } };
  } catch (error) {
    console.error("Unexpected error during authentication:", error);
    return {
      ok: false,
      status: 500,
      body: { message: "Internal server error during authentication" },
    };
  }
}

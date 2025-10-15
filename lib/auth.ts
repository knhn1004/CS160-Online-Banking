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
  const authHeader = request.headers.get("authorization") ?? undefined;
  const supabase = await createClient(authHeader);
  const bearer = authHeader?.replace(/^Bearer\s+/i, "");
  const userResult = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser();
  const { user } = userResult.data;
  if (!user) {
    return { ok: false, status: 401, body: { message: "Unauthorized" } };
  }
  return { ok: true, supabaseUser: { id: user.id, email: user.email } };
}

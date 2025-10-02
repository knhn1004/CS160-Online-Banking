import { createClient } from "@/utils/supabase/server";

export type AuthResult =
  | { ok: true; supabaseUser: { id: string; email?: string | null } }
  | { ok: false; status: number; body: { message: string } };

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

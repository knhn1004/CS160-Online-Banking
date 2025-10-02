import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = async (authorizationHeader?: string) => {
  const cookieStore = await cookies();
  const token = authorizationHeader
    ? authorizationHeader.replace(/^Bearer\s+/i, "")
    : undefined;
  const normalizedAuthHeader = token ? `Bearer ${token}` : undefined;
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {}
      },
    },
    // When a bearer token is provided, forward it to Supabase. This enables
    // stateless auth for clients that don't use cookies (e.g., mobile apps).
    ...(normalizedAuthHeader
      ? {
          global: {
            headers: { Authorization: normalizedAuthHeader },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      : {}),
  });
};

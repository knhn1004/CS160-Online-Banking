// It was recommended that I make Supabase client a singleton so that the same instance
// is reused across renders and reloads (prevents duplicate listeners, network states, etc.).
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Declare global to ensure client persists.
declare global {
  var __SUPABASE_CLIENT__: ReturnType<typeof createBrowserClient> | undefined;
  var __SUPABASE_AUTH_ERROR_HANDLER_SETUP__: boolean | undefined;
}

export const createClient = (): ReturnType<typeof createBrowserClient> => {
  // If client already exists, use it.
  if (typeof globalThis !== "undefined" && globalThis.__SUPABASE_CLIENT__) {
    return globalThis.__SUPABASE_CLIENT__;
  }
  // If client doesn't exist, create it.
  const client = createBrowserClient(supabaseUrl, supabaseKey);

  if (typeof globalThis !== "undefined") {
    globalThis.__SUPABASE_CLIENT__ = client;

    // Set up global error handler for refresh token failures (only once)
    if (!globalThis.__SUPABASE_AUTH_ERROR_HANDLER_SETUP__) {
      globalThis.__SUPABASE_AUTH_ERROR_HANDLER_SETUP__ = true;

      // Handle auth state changes (including token refresh failures)
      client.auth.onAuthStateChange((event, session) => {
        if (
          (event === "SIGNED_OUT" ||
            (event === "TOKEN_REFRESHED" && !session)) &&
          typeof window !== "undefined"
        ) {
          const pathname = window.location.pathname;
          if (
            !pathname.includes("/login") &&
            !pathname.includes("/signup") &&
            !pathname.includes("/auth")
          ) {
            window.location.replace("/login");
          }
        }
      });
    }
  }

  // Export a factory that always returns the same client instance.
  return client;
};

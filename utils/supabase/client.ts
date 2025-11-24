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

      // Listen for auth state changes to handle refresh token errors
      // When refresh token fails, Supabase will emit SIGNED_OUT event
      client.auth.onAuthStateChange((event, session) => {
        // Handle SIGNED_OUT events that may occur due to refresh token failures
        if (event === "SIGNED_OUT" && !session) {
          // Session was cleared (possibly due to invalid refresh token)
          // Redirect to login if we're not already on auth pages
          if (
            typeof window !== "undefined" &&
            !window.location.pathname.includes("/login") &&
            !window.location.pathname.includes("/signup") &&
            !window.location.pathname.includes("/auth")
          ) {
            // Use replace instead of assign to avoid adding to history
            window.location.replace("/login");
          }
        }
      });

      // Set up global error handler for unhandled auth errors
      if (typeof window !== "undefined") {
        window.addEventListener("unhandledrejection", (event) => {
          const error = event.reason;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          // Check if it's a refresh token error
          if (
            errorMessage.includes("Invalid Refresh Token") ||
            errorMessage.includes("Refresh Token Not Found") ||
            errorMessage.includes("refresh_token_not_found") ||
            (error?.name === "AuthApiError" && errorMessage.includes("refresh"))
          ) {
            // Prevent the error from being logged to console
            event.preventDefault();
            // Clear the session
            client.auth.signOut().catch(() => {
              // Ignore errors during sign out
            });
            // Redirect to login if we're not already there
            if (
              !window.location.pathname.includes("/login") &&
              !window.location.pathname.includes("/signup") &&
              !window.location.pathname.includes("/auth")
            ) {
              window.location.replace("/login");
            }
          }
        });
      }
    }
  }

  // Export a factory that always returns the same client instance.
  return client;
};

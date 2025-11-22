// This endpoint is necessary so that after a client successfully calls the signup endpoint, the cookies can be updated and the user can switch to an authenticated session.
// Supabase technically handles this by default (I think), but we can control redirection using this.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

type AuthExchangeResult = {
  data?: { session?: unknown; user?: unknown } | null;
  error?: { message?: string } | null;
};

type AuthClient = {
  exchangeCodeForSession?: (
    arg: Request | string | { code: string },
  ) => Promise<AuthExchangeResult>;
  getSessionFromUrl?: () => Promise<AuthExchangeResult>;
};

// Callback will do what the above comment mentions as well as redirect the browser.
export async function GET(req: NextRequest) {
  // Parse the incoming request so we can read the query params and origin.
  const url = new URL(req.url);

  // Read OAuth provider's error query parameter (if there is one).
  const error = url.searchParams.get("error");
  // If there is an error, we redirect to the signup page to try again.
  if (error) {
    return NextResponse.redirect(
      new URL(`/signup?error=callback`, url.origin),
      303,
    );
  }

  // Create a Supabase server-side client.
  const supabase = await createClient();

  // Try helper that accepts the Request (supported by @supabase/ssr createServerClient).
  // Fallback to SDK shapes if helper isn't present.
  const auth = supabase.auth as unknown as AuthClient;
  // Try to turn the OAuth redirect into a server session w/ various fallbacks.
  let exchangeResult: AuthExchangeResult | undefined;
  try {
    if (typeof auth.exchangeCodeForSession === "function") {
      // Many server helpers accept the Request directly and will set cookies via the cookie handler.
      try {
        exchangeResult = await auth.exchangeCodeForSession(req);
      } catch {
        // Fallback: try string/object variants if the SDK requires code only.
        const code = url.searchParams.get("code");
        if (!code) throw new Error("missing_code");
        // Last fallback, try object form ({ code }).
        try {
          exchangeResult = await auth.exchangeCodeForSession(code);
        } catch {
          exchangeResult = await auth.exchangeCodeForSession?.({ code });
        }
      }
    } else if (typeof auth.getSessionFromUrl === "function") {
      exchangeResult = await auth.getSessionFromUrl();
    } else {
      throw new Error("no_exchange_method");
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(msg)}`, url.origin),
      303,
    );
  }

  if (exchangeResult?.error) {
    const msg = exchangeResult.error?.message ?? "exchange_failed";
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(msg)}`, url.origin),
      303,
    );
  }

  // Onboarding is NOT finalized here.
  // The client will call POST /api/user/onboard after redirect.

  // Return redirect.
  // createServerClient should have written Set-Cookie into Next's cookie store.
  const requestedRedirect = url.searchParams.get("redirectTo") ?? "";
  const safeRedirect =
    requestedRedirect && requestedRedirect.startsWith("/")
      ? requestedRedirect
      : "/dashboard";

  return NextResponse.redirect(new URL(safeRedirect, url.origin), 303);
}

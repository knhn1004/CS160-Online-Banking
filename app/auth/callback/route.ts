import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { finalizeOnboardFromSupabaseUser } from "@/app/lib/onboard";

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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/signup?error=callback`, url.origin),
      303,
    );
  }

  // createServerClient wrapper from utils/supabase/server.ts
  const supabase = await createClient();

  // Try helper that accepts the Request (supported by @supabase/ssr createServerClient)
  // Fallback to SDK shapes if helper isn't present.
  const auth = supabase.auth as unknown as AuthClient;
  let exchangeResult: AuthExchangeResult | undefined;
  try {
    if (typeof auth.exchangeCodeForSession === "function") {
      // many server helpers accept the Request directly and will set cookies via the cookie handler
      try {
        exchangeResult = await auth.exchangeCodeForSession(req);
      } catch {
        // fallback: try string/object variants if the SDK requires code only
        const code = url.searchParams.get("code");
        if (!code) throw new Error("missing_code");
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

  // Server-finalize onboarding using the same server supabase client (avoids cookie forwarding)
  try {
    await finalizeOnboardFromSupabaseUser(supabase);
  } catch (e) {
    console.error("[auth/callback] finalizeOnboard error:", e);
    // don't block user's redirect
  }

  // Return redirect. createServerClient should have written Set-Cookie into Next's cookie store
  const requestedRedirect = url.searchParams.get("redirectTo") ?? "";
  const safeRedirect =
    requestedRedirect && requestedRedirect.startsWith("/")
      ? requestedRedirect
      : "/dashboard";

  return NextResponse.redirect(new URL(safeRedirect, url.origin), 303);
}

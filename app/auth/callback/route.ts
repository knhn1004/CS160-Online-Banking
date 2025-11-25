import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * OAuth callback handler - exchanges OAuth code for session and redirects.
 * Supabase SSR client handles cookie setting automatically.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Handle OAuth errors
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/signup?error=callback`, url.origin),
      303,
    );
  }

  const supabase = await createClient();
  const code = url.searchParams.get("code");

  if (code) {
    try {
      // Exchange code for session (SSR client handles cookies automatically)
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        return NextResponse.redirect(
          new URL(
            `/signup?error=${encodeURIComponent(exchangeError.message)}`,
            url.origin,
          ),
          303,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "exchange_failed";
      return NextResponse.redirect(
        new URL(`/signup?error=${encodeURIComponent(msg)}`, url.origin),
        303,
      );
    }
  }

  // Redirect to dashboard or requested path
  const requestedRedirect = url.searchParams.get("redirectTo") ?? "";
  const safeRedirect =
    requestedRedirect && requestedRedirect.startsWith("/")
      ? requestedRedirect
      : "/dashboard";

  return NextResponse.redirect(new URL(safeRedirect, url.origin), 303);
}

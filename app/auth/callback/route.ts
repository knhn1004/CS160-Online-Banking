import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type AuthExchangeResult = {
  data?: unknown;
  error?: { message?: string } | null;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error)}`, url.origin),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  const supabase = await createClient();

  // Narrow the auth surface so we don't use `any`
  const auth = supabase.auth as unknown as {
    exchangeCodeForSession?: (
      opts: { code: string } | string,
    ) => Promise<AuthExchangeResult>;
    getSessionFromUrl?: () => Promise<AuthExchangeResult>;
  };

  try {
    // Prefer the object-form exchange, but fall back if the SDK variant expects a string or uses getSessionFromUrl.
    if (typeof auth.exchangeCodeForSession === "function") {
      // Try object form first, then fallback to string form if needed.
      let res: AuthExchangeResult | undefined;
      try {
        res = await auth.exchangeCodeForSession({ code });
      } catch {
        // ignore and try string form below
      }

      if (!res) {
        try {
          res = await (
            auth.exchangeCodeForSession as (
              arg: string,
            ) => Promise<AuthExchangeResult>
          )(code);
        } catch {
          // ignore
        }
      }

      if (res?.error) {
        return NextResponse.redirect(
          new URL(
            `/auth/error?error=${encodeURIComponent(res.error.message ?? "exchange_failed")}`,
            url.origin,
          ),
        );
      }
    } else if (typeof auth.getSessionFromUrl === "function") {
      const { error: exErr } = await auth.getSessionFromUrl();
      if (exErr) {
        return NextResponse.redirect(
          new URL(
            `/auth/error?error=${encodeURIComponent(exErr.message ?? "exchange_failed")}`,
            url.origin,
          ),
        );
      }
    } else {
      return NextResponse.redirect(
        new URL(
          `/auth/error?error=${encodeURIComponent("server_exchange_not_supported")}`,
          url.origin,
        ),
      );
    }

    return NextResponse.redirect(new URL("/auth/complete", url.origin));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(msg)}`, url.origin),
    );
  }
}

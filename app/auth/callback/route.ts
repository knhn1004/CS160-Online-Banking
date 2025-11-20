import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  console.log("[auth/callback] hit:", req.url);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const supabase = await createClient();

  //   return NextResponse.json({ ok: true, exchange: res ?? null });
  // }

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error)}`, url.origin),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  // const res = await (supabase.auth as any).exchangeCodeForSession?.(code).catch((e: any) => ({ error: e }));
  // console.log("[auth/callback] exchange result:", res);

  // This sets HttpOnly cookies on the response
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      new URL(
        `/auth/error?error=${encodeURIComponent(exchangeError.message ?? "exchange_failed")}`,
        url.origin,
      ),
    );
  }

  // Optional: best-effort finalize (don’t block redirect if it fails).
  // Note: this same-request fetch won’t include the new cookie yet; that’s fine.
  try {
    await fetch(new URL("/api/user/onboard", url.origin), { method: "POST" });
  } catch {
    // ignore; client page or dashboard can also trigger finalize
  }

  return NextResponse.redirect(new URL("/auth/complete", url.origin));
}

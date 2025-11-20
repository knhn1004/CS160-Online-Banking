"use client";
import { useEffect } from "react";

export default function AuthCallback() {
  useEffect(() => {
    let mounted = true;

    (async () => {
      // load the client only in the browser
      const mod = await import("@/utils/supabase/client");
      const supabase = mod.createClient();

      try {
        // 1) try immediate session (createClient may have processed the URL hash)
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          if (mounted) window.location.assign("/");
          return;
        }
      } catch {
        /* ignore and fall through to subscription */
      }

      // 2) subscribe to auth state change and redirect on SIGNED_IN
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          try {
            subscription.unsubscribe();
          } catch {}
          if (mounted) window.location.assign("/");
        }
      });
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return <p className="text-sm text-muted-foreground">Signing you in…</p>;
}

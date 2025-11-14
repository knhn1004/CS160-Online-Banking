"use client";
import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AuthCallback() {
  useEffect(() => {
    // touching the client ensures session is read from URL hash & saved
    const supabase = createClient();
    // after the client hydrates, you can send them “home”
    const t = setTimeout(() => window.location.assign("/"), 300);
    return () => clearTimeout(t);
  }, []);
  return <p className="text-sm text-muted-foreground">Signing you in…</p>;
}

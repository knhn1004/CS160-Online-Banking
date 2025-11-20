"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import type { Session } from "@supabase/supabase-js";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

type Profile = {
  name?: string | null;
  email?: string | null;
};

export function UserMenu() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialized, setInitialized] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    let isMounted = true;

    const setFromUser = (user: User | null) => {
      if (!isMounted) return;
      if (!user) {
        setProfile(null);
        return;
      }
      const email = user.email ?? null;
      const name = user.user_metadata?.full_name ?? null;
      setProfile({ email, name });
    };

    supabase.auth
      .getUser()
      .then((res: { data?: { user?: User | null } | null }) => {
        setFromUser((res.data && res.data.user) ?? null);
        setInitialized(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setFromUser(session?.user ?? null);
      },
    );

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const onSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  // Avoid flicker: render nothing until we've read auth state
  if (!initialized) return null;
  // Hide on login page entirely
  if (pathname === "/login") return null;
  // When logged out: show Login button
  if (!profile) {
    return (
      <Link href="/login">
        <Button size="sm">Login</Button>
      </Link>
    );
  }

  const initials = (profile.name ?? profile.email ?? "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">
            {profile.name ?? profile.email ?? "User"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        {profile.email ? (
          <DropdownMenuItem disabled>{profile.email}</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;

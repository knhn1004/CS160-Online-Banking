import Link from "next/link";
import { UserMenu } from "./user-menu";

export async function Navbar() {
  return (
    <nav className="border-b">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          CS160 Bank
        </Link>
        <UserMenu />
      </div>
    </nav>
  );
}



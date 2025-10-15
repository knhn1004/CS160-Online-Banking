import Link from "next/link";
import Image from "next/image";
import { UserMenu } from "./user-menu";

export function Navbar() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/Bank160.png"
            alt="Bank160 Logo"
            width={126}
            height={126}
            priority
          />
          <span className="sr-only">Bank160 Home</span>
        </Link>
        <UserMenu />
      </div>
    </nav>
  );
}

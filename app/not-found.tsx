import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12 
                    bg-background text-foreground transition-colors"
    >
      <h1 className="text-4xl font-bold mb-4">404 | Page Not Found</h1>

      <p className="text-lg text-muted-foreground mb-8">
        Looks like you don’t have access to this page.
      </p>

      <Link
        href="/dashboard"
        className="px-6 py-3 rounded-lg font-medium bg-primary text-primary-foreground 
                   hover:opacity-90 transition"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}

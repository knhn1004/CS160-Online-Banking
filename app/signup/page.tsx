import SignupForm from "./SignupForm.client";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function Page() {
  // If your server util is synchronous, drop the `await`:
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already signed in, bounce to dashboard
  if (user) redirect("/dashboard");

  // No user => no user_metadata (drafts live on the auth user)
  const initialDraft = null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md mx-auto px-6 py-12 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-semibold mb-6 text-center">Sign up</h1>
        <SignupForm initialDraft={initialDraft} />
      </div>
    </div>
  );
}

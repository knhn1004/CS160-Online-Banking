// This is the parent server component for the signup page.
import SignupPageClient from "./SignupPageClient";
import { signupAction } from "../actions/signupAction";
import { createClient } from "@/utils/supabase/server"; //
import { redirect } from "next/navigation";
import type { z } from "zod";
import { SignupSchema, USStateTerritorySchema } from "../../lib/schemas/user";
import { Input } from "@/components/ui/input";
import type { USStateTerritory } from "../../lib/schemas/user";

const PrefillSchema = SignupSchema.omit({
  password: true,
  confirmPassword: true,
});

// Every time a user tries to access the signup page, this component will run.
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  // await searchParams before using properties (Next.js requires this)
  const sp = await searchParams;
  const errorMessage = sp?.error ? decodeURIComponent(String(sp.error)) : null;

  // Create a temporary, server-side Supabase client bound to the user's current request.
  // This will read HttpOnly cookies because we exported from server.ts!
  const supabase = await createClient();
  // Check for an existing session by seeing if the current user can be resolved using cookies.
  const { data } = await supabase.auth.getUser();
  const rawUser =
    (data as unknown as { user?: unknown } | undefined)?.user ?? null;

  // We want to see if the user metadata can be recovered first before giving them a new form.
  let initialDraft: z.infer<typeof PrefillSchema> | null = null; // New user -> no stored information.
  if (rawUser && typeof rawUser === "object") {
    const userMeta = (rawUser as { user_metadata?: unknown }).user_metadata;
    const candidate =
      (userMeta as { profileDraft?: unknown } | undefined)?.profileDraft ??
      null;
    // Still need to perform basic validation on user metadata.
    if (candidate != null && typeof candidate === "object") {
      const parsed = PrefillSchema.safeParse(candidate);
      if (parsed.success) {
        initialDraft = parsed.data;
      } else {
        initialDraft = null;
      }
    }
  }

  // If the user is already signed in and there's no draft to prefill, we should redirect them to the dashboard.
  if (rawUser && !initialDraft) redirect("/dashboard");

  const STATE_OPTIONS = (USStateTerritorySchema.options ??
    []) as readonly USStateTerritory[];

  // Server rendering!
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md mx-auto px-6 py-12 bg-card text-card-foreground rounded-lg shadow-md border">
        <h1 className="text-2xl font-semibold mb-6 text-center">Sign up</h1>

        {errorMessage && (
          <div className="mb-4 text-sm text-destructive">{errorMessage}</div>
        )}

        <form
          id="signup-form"
          action={signupAction}
          className="w-full max-w-sm space-y-4"
        >
          {/* Username */}
          <div className="space-y-1">
            <label
              htmlFor="username"
              className="text-sm font-medium text-foreground"
            >
              Username <span className="text-destructive text-xs ml-1">*</span>
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              defaultValue={initialDraft?.username ?? ""}
              aria-describedby="username-error"
              required
            />
            <p id="username-error" className="text-sm text-destructive mt-1" />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email <span className="text-destructive text-xs ml-1">*</span>
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initialDraft?.email ?? ""}
              aria-describedby="email-error"
              required
            />
            <p id="email-error" className="text-sm text-destructive mt-1" />
          </div>

          {/* Password / Confirm */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                aria-describedby="password-error"
                required
              />
              <p
                id="password-error"
                className="text-sm text-destructive mt-1"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-foreground"
              >
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                aria-describedby="confirmPassword-error"
                required
              />
              <p
                id="confirmPassword-error"
                className="text-sm text-destructive mt-1"
              />
            </div>
          </div>

          {/* First / Last */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="firstName"
                className="text-sm font-medium text-foreground"
              >
                First name
              </label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                defaultValue={initialDraft?.firstName ?? ""}
                aria-describedby="firstName-error"
              />
              <p
                id="firstName-error"
                className="text-sm text-destructive mt-1"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="lastName"
                className="text-sm font-medium text-foreground"
              >
                Last name
              </label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                defaultValue={initialDraft?.lastName ?? ""}
                aria-describedby="lastName-error"
              />
              <p
                id="lastName-error"
                className="text-sm text-destructive mt-1"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label
              htmlFor="phoneNumber"
              className="text-sm font-medium text-foreground"
            >
              Phone number
            </label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              defaultValue={initialDraft?.phoneNumber ?? ""}
              aria-describedby="phoneNumber-error"
            />
            <p
              id="phoneNumber-error"
              className="text-sm text-destructive mt-1"
            />
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label
              htmlFor="streetAddress"
              className="text-sm font-medium text-foreground"
            >
              Street address
            </label>
            <Input
              id="streetAddress"
              name="streetAddress"
              type="text"
              defaultValue={initialDraft?.streetAddress ?? ""}
              aria-describedby="streetAddress-error"
            />
            <p
              id="streetAddress-error"
              className="text-sm text-destructive mt-1"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="addressLine2"
              className="text-sm font-medium text-foreground"
            >
              Address line 2
            </label>
            <Input
              id="addressLine2"
              name="addressLine2"
              type="text"
              defaultValue={initialDraft?.addressLine2 ?? ""}
              aria-describedby="addressLine2-error"
            />
            <p
              id="addressLine2-error"
              className="text-sm text-destructive mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="city"
                className="text-sm font-medium text-foreground"
              >
                City
              </label>
              <Input
                id="city"
                name="city"
                type="text"
                defaultValue={initialDraft?.city ?? ""}
                aria-describedby="city-error"
              />
              <p id="city-error" className="text-sm text-destructive mt-1" />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="stateOrTerritory"
                className="text-sm font-medium text-foreground"
              >
                State/Territory
              </label>
              <select
                id="stateOrTerritory"
                name="stateOrTerritory"
                defaultValue={initialDraft?.stateOrTerritory ?? ""}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                aria-describedby="stateOrTerritory-error"
              >
                <option value="">Select a state</option>
                {STATE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p
                id="stateOrTerritory-error"
                className="text-sm text-destructive mt-1"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="postalCode"
              className="text-sm font-medium text-foreground"
            >
              Postal code
            </label>
            <Input
              id="postalCode"
              name="postalCode"
              type="text"
              defaultValue={initialDraft?.postalCode ?? ""}
              aria-describedby="postalCode-error"
            />
            <p
              id="postalCode-error"
              className="text-sm text-destructive mt-1"
            />
          </div>

          {/* client-side pre-submit validator + submit button */}
          <SignupPageClient formId="signup-form" initialDraft={initialDraft} />
        </form>
      </div>
    </div>
  );
}

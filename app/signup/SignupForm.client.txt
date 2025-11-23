// After the parent server component page.tsx runs, this client component should be rendered.
"use client";
import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SignupSchema, USStateTerritorySchema } from "@/lib/schemas/user";
import { z } from "zod";
import type { USStateTerritory } from "@/lib/schemas/user";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";

// We should first pre-define what goes inside each form field based on DB expectations.
// This is for client-side form validation.
const PrefillSchema = SignupSchema.omit({
  password: true,
  confirmPassword: true,
}); // Don't store passwords!
type PrefillDraft = z.infer<typeof PrefillSchema>;

const US_STATES = USStateTerritorySchema.options as readonly USStateTerritory[];

// Type safety (reuse SignupSchema from /lib/schemas/user.ts!):
// If the server component is edited to pass in prefilled info, this can accept it too.
type Props = { initialDraft?: PrefillDraft | null };

// Entry point for the client component (renders the interactive form & handlers).
export default function SignupForm({ initialDraft }: Props) {
  // We'll need redirection later.
  const router = useRouter();

  // Create a browser Supabase client that is stateful, long-lived, subscribes to events, stores session info, etc.
  const supabase = createSupabaseClient();

  // Local React state hooks to drive the form UI & control flows.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [preparedEmail, setPreparedEmail] = useState<string | null>(null);

  /*****************************************************************************************************************************************************************/
  // Though the server should technically redirect earlier if the user is already signed in, this function call serves as a guardrail if for some reason, it fails.
  const tryAutoOnboard = useCallback(async (): Promise<void> => {
    try {
      // The onboarding endpoint handles idempotency, so it's fine to POST to it.
      // If the user already exists, the endpoint should succeed and return as such.
      const attempt = await fetch("/api/user/onboard", { method: "POST" });
      // We need to clear the profileDraft in the browser upon success.
      if (attempt.ok) {
        try {
          await supabase.auth.updateUser?.({ data: { profileDraft: null } });
        } catch (err) {
          /* Non-critical client update failure. */
          console.warn(
            "[tryAutoOnboard] failed to clear profileDraft on client during optimistic check:",
            err,
          );
        }
        router.push("/dashboard");
        return;
      }
    } catch (err) {
      /* Network or security error; read client metadata as fallback. */
      console.warn(
        "[tryAutoOnboard] network or security error while contacting /api/user/onboard during optimistic check",
        err,
      );
    }

    // Read draft from client-side supabase user_metadata.
    // Get current auth user and destructure the response for data component.
    const { data: userData } = await supabase.auth.getUser();
    // Read userData.user safely and casts it to a shape that may contain user_metadata, then extract it.
    const userMeta = (userData?.user as { user_metadata?: unknown } | undefined)
      ?.user_metadata as { profileDraft?: unknown } | undefined;
    // Read profileDraft out of the metadata and cast it to a generic object shape.
    const draft = userMeta?.profileDraft as Record<string, unknown> | undefined;
    if (!draft) {
      console.debug(
        "[tryAutoOnboard] no profileDraft present, nothing to do during optimistic check",
      );
      return;
    }

    // Trigger server-side onboarding (full draft is not sent from browser to prevent malicious mutations).
    // Same logic as above.
    const resp = await fetch("/api/user/onboard", { method: "POST" });
    if (resp.ok) {
      try {
        await supabase.auth.updateUser?.({ data: { profileDraft: null } });
      } catch (err) {
        console.warn(
          "[tryAutoOnboard] failed to clear profileDraft on client during deliberate POST:",
          err,
        );
      }
      // Redirect the user to the dashboard.
      router.push("/dashboard");
    } else {
      console.warn("Auto-onboard failed:", await resp.text());
    }
  }, [supabase, router]);
  /*****************************************************************************************************************************************************************/

  // Subscribe to auth state changes to attempt server-side onboarding after sign-in.
  useEffect(() => {
    // Subscribe.
    const resp = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN") void tryAutoOnboard();
    });

    // Read subscription safely.
    const subscription = (
      resp?.data as { subscription?: { unsubscribe: () => void } } | undefined
    )?.subscription ?? { unsubscribe: () => {} };

    // Attempt once on mount in case we're already signed in.
    void tryAutoOnboard();

    return () => {
      // Remember to unsubscribe.
      try {
        if (subscription && typeof subscription.unsubscribe === "function") {
          subscription.unsubscribe();
        } else {
          console.debug(
            "[SignupForm] no valid subscription.unsubscribe to call.",
          );
        }
      } catch (err) {
        console.warn("[SignupForm] subscription.unsubscribe failed:", err);
      }
    };
  }, [supabase, tryAutoOnboard]);

  // Define the form & submission behavior.
  const form = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phoneNumber: "",
      streetAddress: "",
      addressLine2: "",
      city: "",
      stateOrTerritory: "" as "" | USStateTerritory,
      postalCode: "",
    },
    onSubmit: async ({ value }) => {
      setLoading(true);
      setError(null);
      setInfo(null);

      // Client-side validation of submission form contents.
      try {
        const prepared = { ...value, email: value.email.trim().toLowerCase() };
        setPreparedEmail(prepared.email);

        const result = SignupSchema.safeParse(prepared);
        if (!result.success) {
          const zErr = result.error as z.ZodError;
          throw new Error(zErr?.issues?.[0]?.message ?? "Validation failed.");
        }

        const validated = result.data;

        // Server handles the sign-up.
        const resp = await fetch("/api/user/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validated), // This includes the password!
        });

        if (!resp.ok) {
          const body = (await resp.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          throw new Error(body?.error ?? body?.message ?? "Signup failed.");
        }
        setInfo(
          "If an account was created, you should receive a confirmation email shortly. Please check your inbox to complete the onboarding process.",
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Signup failed.");
      } finally {
        setLoading(false);
      }
    },
  });

  // Restore draft provided by the server (initialDraft) or from user_metadata after signup.
  // This is so the user doesn't lose their fields if they navigate away without their DB profile being created.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer server-provided draft from page.tsx.
        if (initialDraft && mounted) {
          const parsed = PrefillSchema.safeParse(initialDraft);
          if (parsed.success) {
            const draft = parsed.data;
            const rawState = String(draft.stateOrTerritory ?? "");
            const stateOrTerritory =
              rawState === "" ||
              US_STATES.includes(rawState as USStateTerritory)
                ? (rawState as "" | USStateTerritory)
                : "";

            // Reset the form before filling it in.
            form.reset({
              username: String(draft.username ?? ""),
              email: String(draft.email ?? ""),
              password: "",
              confirmPassword: "",
              firstName: String(draft.firstName ?? ""),
              lastName: String(draft.lastName ?? ""),
              phoneNumber: String(draft.phoneNumber ?? ""),
              streetAddress: String(draft.streetAddress ?? ""),
              addressLine2: String(draft.addressLine2 ?? ""),
              city: String(draft.city ?? ""),
              stateOrTerritory,
              postalCode: String(draft.postalCode ?? ""),
            });
            return;
          }
        }

        // fallback: read from supabase user_metadata if present
        const { data } = await supabase.auth.getUser();
        const userMeta = (data?.user as { user_metadata?: unknown } | undefined)
          ?.user_metadata as { profileDraft?: unknown } | undefined;
        const draft = userMeta?.profileDraft as
          | Record<string, unknown>
          | undefined;
        if (!mounted || !draft) return;

        const rawState = String(draft["stateOrTerritory"] ?? "");
        const stateOrTerritory =
          rawState === "" || US_STATES.includes(rawState as USStateTerritory)
            ? (rawState as "" | USStateTerritory)
            : "";

        form.reset({
          username: String(draft["username"] ?? ""),
          email: String(draft["email"] ?? ""),
          password: "",
          confirmPassword: "",
          firstName: String(draft["firstName"] ?? ""),
          lastName: String(draft["lastName"] ?? ""),
          phoneNumber: String(draft["phoneNumber"] ?? ""),
          streetAddress: String(draft["streetAddress"] ?? ""),
          addressLine2: String(draft["addressLine2"] ?? ""),
          city: String(draft["city"] ?? ""),
          stateOrTerritory: stateOrTerritory,
          postalCode: String(draft["postalCode"] ?? ""),
        });
      } catch (err) {
        console.debug("[SignupForm] Draft restoration failed:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initialDraft, form, supabase]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="w-full max-w-sm space-y-4"
    >
      {/* Username */}
      <form.Field
        name="username"
        validators={{
          onChange: ({ value }) => {
            const result = z
              .string()
              .min(3, "Username must be at least 3 characters")
              .safeParse(value);
            return result.success ? undefined : result.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="username" className="text-sm font-medium">
              Username <span className="text-destructive text-xs ml-1">*</span>
            </label>
            <Input
              id="username"
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              required
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Email */}
      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) => {
            const result = z
              .string()
              .email("Invalid email address")
              .safeParse(value);
            return result.success ? undefined : result.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email <span className="text-destructive text-xs ml-1">*</span>
            </label>
            <Input
              id="email"
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              required
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Password */}
      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) => {
            const result = z
              .string()
              .min(8, "Password must be at least 8 characters")
              .regex(
                /[A-Z]/,
                "Password must contain at least one uppercase letter",
              )
              .regex(
                /[a-z]/,
                "Password must contain at least one lowercase letter",
              )
              .regex(/[0-9]/, "Password must contain at least one number")
              .safeParse(value);
            return result.success ? undefined : result.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password <span className="text-destructive text-xs ml-1">*</span>
            </label>
            <Input
              id="password"
              type="password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              required
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Confirm Password */}
      <form.Field
        name="confirmPassword"
        validators={{
          onChangeListenTo: ["password"],
          onChange: ({ value, fieldApi }) => {
            const password = fieldApi.form.getFieldValue("password");
            return value !== password ? "Passwords do not match" : undefined;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password{" "}
              <span className="text-destructive text-xs ml-1">*</span>
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              required
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* First Name */}
      <form.Field
        name="firstName"
        validators={{
          onChange: ({ value }) => {
            const result = z
              .string()
              .min(1, "First name is required")
              .safeParse(value);
            return result.success ? undefined : result.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="firstName" className="text-sm font-medium">
              First name{" "}
              <span className="text-destructive text-xs ml-1">*</span>
            </label>
            <Input
              id="firstName"
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              required
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Last Name */}
      <form.Field
        name="lastName"
        validators={{
          onChange: ({ value }) => {
            const result = z
              .string()
              .min(1, "Last name is required")
              .safeParse(value);
            return result.success ? undefined : result.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="lastName" className="text-sm font-medium">
              Last name <span className="text-destructive text-xs ml-1">*</span>
            </label>
            <Input
              id="lastName"
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              required
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Phone */}
      <form.Field
        name="phoneNumber"
        validators={{
          onChange: ({ value }) => {
            const digits = (value ?? "").replace(/\D/g, "");
            return digits.length >= 10
              ? undefined
              : "Enter a valid phone number";
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="phoneNumber" className="text-sm font-medium">
              Phone number
            </label>
            <Input
              id="phoneNumber"
              type="tel"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="(555) 123-4567 or 555-123-4567"
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Street Address */}
      <form.Field
        name="streetAddress"
        validators={{
          onChange: ({ value }) => {
            const result = z
              .string()
              .min(1, "Street address is required")
              .safeParse(value);
            return result.success ? undefined : result.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="streetAddress" className="text-sm font-medium">
              Street address
            </label>
            <Input
              id="streetAddress"
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Address Line 2 */}
      <form.Field name="addressLine2">
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="addressLine2" className="text-sm font-medium">
              Address line 2{" "}
              <span className="text-gray-500 text-xs ml-1">(optional)</span>
            </label>
            <Input
              id="addressLine2"
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      {/* City */}
      <form.Field
        name="city"
        validators={{
          onChange: ({ value }) => {
            const result = z
              .string()
              .min(1, "City is required")
              .safeParse(value);
            return result.success ? undefined : result.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="city" className="text-sm font-medium">
              City
            </label>
            <Input
              id="city"
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* State / Territory */}
      <form.Field
        name="stateOrTerritory"
        validators={{
          onChange: ({ value }) => {
            if (!value) return "State/Territory is required";
            return undefined;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="stateOrTerritory" className="text-sm font-medium">
              State/Territory
            </label>
            <select
              id="stateOrTerritory"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) =>
                field.handleChange(e.target.value as "" | USStateTerritory)
              }
              required
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">Select a state</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Postal Code */}
      <form.Field
        name="postalCode"
        validators={{
          onChange: ({ value }) => {
            const result = z
              .string()
              .regex(
                /^\d{5}(-?\d{4})?$/,
                "Postal code must be 5 digits or ZIP+4 format",
              )
              .safeParse(value || "");
            return result.success ? undefined : result.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor="postalCode" className="text-sm font-medium">
              Postal code
            </label>
            <Input
              id="postalCode"
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              required
              placeholder="12345 or 12345-6789"
              maxLength={10}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? (
        <p className="text-sm text-blue-600 text-center">{info}</p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing up..." : "Sign up"}
      </Button>

      <div className="flex justify-center mt-3">
        <Button
          type="button"
          variant="outline"
          className="mx-auto"
          onClick={async () => {
            setError(null);
            setInfo(null);
            if (!preparedEmail) {
              setError("No email available to resend confirmation email to.");
              return;
            }
            try {
              // Supabase client may return an untyped object.
              // Cast to a known shape.
              const resendResp = (await supabase.auth.resend?.({
                type: "signup",
                email: preparedEmail,
              })) as unknown as { error?: { message?: string } } | null;
              const resendError = resendResp?.error ?? null;
              if (resendError) {
                setError(
                  resendError.message ?? "Failed to resend confirmation.",
                );
              } else {
                setInfo(
                  "Confirmation email sent. Check your inbox (and spam).",
                );
              }
            } catch (resendErr) {
              setError(
                resendErr instanceof Error
                  ? resendErr.message
                  : "Failed to resend confirmation.",
              );
            }
          }}
        >
          Resend confirmation email
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <a href="/login" className="text-primary hover:underline font-medium">
          Log in
        </a>
      </p>
    </form>
  );
}

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SignupSchema, USStateTerritorySchema } from "@/lib/schemas/user";
import { z } from "zod";

// Get US states/territories from schema
const US_STATES = USStateTerritorySchema.options;

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [preparedEmail, setPreparedEmail] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Normalize US phone to E.164 for your zod /^\+\d{10,15}$/
  function toE164US(input?: string) {
    if (!input) return "";
    const d = input.replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    return ""; // return empty if invalid (or throw if you prefer)
  }

  const tryAutoOnboard = useCallback(async () => {
    // 1) must have a Supabase session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const profRes = await fetch("/api/user/profile", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });

    if (profRes.ok) {
      const { user: _user } = (await profRes.json()) as { user?: unknown };
    } else {
      // If you see 404, then onboarding was incomplete OR cache needs invalidation.
    }

    // 2) if profile already exists, bail (prevents dupes)
    const exists = await fetch("/api/user/profile/me", { cache: "no-store" });
    if (exists.ok) return;

    // 3) pull the saved draft
    const raw = localStorage.getItem("pendingOnboard");
    if (!raw) return;
    const draft = JSON.parse(raw);

    // 4) build payload that matches your OnboardSchema
    const payload = {
      username: draft.username,
      first_name: draft.firstName,
      last_name: draft.lastName,
      email: draft.email,
      phone_number: toE164US(draft.phoneNumber), // MUST match /^\+\d{10,15}$/
      street_address: draft.streetAddress,
      address_line_2: draft.addressLine2 ?? null,
      city: draft.city,
      state_or_territory: draft.stateOrTerritory, // must be one of your Prisma enum values
      postal_code: draft.postalCode, // /^\d{5}(-\d{4})?$/
      country: draft.country ?? "USA",
      role: draft.role ?? "customer", // must be in RoleEnum
    };

    // 5) call onboard WITH the Bearer token
    const resp = await fetch("/api/user/onboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`, // <-- REQUIRED by your route
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      localStorage.removeItem("pendingOnboard");
      window.location.assign("/dashboard");
    } else {
      console.warn("Auto-onboard failed:", await resp.text());
    }
  }, [supabase]);

  // Run once on mount, and again when the auth state flips to SIGNED_IN
  useEffect(() => {
    void tryAutoOnboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        void tryAutoOnboard();
      }
    });

    return () => subscription.unsubscribe();
  }, [tryAutoOnboard, router]);

  // Redirect user if already authenticated:
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.push("/dashboard");
      }
    };
    checkAuth();
  }, [router]);

  // User signup form fields:
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
      stateOrTerritory: "" as
        | ""
        | "AL"
        | "AK"
        | "AZ"
        | "AR"
        | "CA"
        | "CO"
        | "CT"
        | "DE"
        | "DC"
        | "FL"
        | "GA"
        | "HI"
        | "ID"
        | "IL"
        | "IN"
        | "IA"
        | "KS"
        | "KY"
        | "LA"
        | "ME"
        | "MD"
        | "MA"
        | "MI"
        | "MN"
        | "MS"
        | "MO"
        | "MT"
        | "NE"
        | "NV"
        | "NH"
        | "NJ"
        | "NM"
        | "NY"
        | "NC"
        | "ND"
        | "OH"
        | "OK"
        | "OR"
        | "PA"
        | "RI"
        | "SC"
        | "SD"
        | "TN"
        | "TX"
        | "UT"
        | "VT"
        | "VA"
        | "WA"
        | "WV"
        | "WI"
        | "WY"
        | "PR"
        | "GU"
        | "VI"
        | "AS"
        | "MP",
      postalCode: "",
    },

    // When the user submits their form...
    onSubmit: async ({ value }) => {
      console.log("[signup] submit start", value); // For debugging in dev tools.

      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        // 1) Validate user input first:
        const prepared = {
          ...value,
          email: value.email.trim().toLowerCase(), // CASE-INSENSITIVE!!!
        };

        setPreparedEmail(prepared.email);

        const result = SignupSchema.safeParse(prepared);
        if (!result.success) {
          const firstError = result.error.issues[0];
          throw new Error(firstError?.message || "Validation failed");
        }

        const profileToPersist = {
          username: prepared.username,
          firstName: prepared.firstName,
          lastName: prepared.lastName,
          email: prepared.email,
          phoneNumber: prepared.phoneNumber,
          streetAddress: prepared.streetAddress,
          addressLine2: prepared.addressLine2 || null,
          city: prepared.city,
          stateOrTerritory: prepared.stateOrTerritory,
          postalCode: prepared.postalCode,
          country: "USA",
          role: "customer", // This signup page is for customers ONLY, not for bank staff.
        };

        // Persist form data so we can finish onboarding after email confirmation (sensitive information is omitted):
        localStorage.setItem(
          "pendingOnboard",
          JSON.stringify(profileToPersist),
        );

        // 2) Sign up only — onboarding is NOT complete yet.
        console.log("[signup] calling supabase.auth.signUp"); // Debugging for dev tools.
        const { data, error } = await supabase.auth.signUp({
          email: prepared.email,
          password: prepared.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        console.log("[signup] result", { data, error }); // Debugging for dev tools.

        if (error) {
          // Supabase typically returns 'User already registered' (message varies)
          if (/already/i.test(error.message)) {
            setInfo(
              "This email is already registered. Check your inbox for the confirmation link or resend it.",
            );
            // Optional: show a "Resend confirmation" button
          } else {
            setError(error.message);
          }
          return;
        }

        // 3) Notify the user to confirm email; onboarding will complete after authentication.
        console.log("[signup] signUp ok");
        setInfo(
          "Check your email for a confirmation link to complete the onboarding process.",
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Signup failed.");
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="w-full max-w-sm space-y-4"
      >
        {/* --- your existing fields unchanged below --- */}
        <form.Field
          name="username"
          validators={{
            onChange: ({ value }) => {
              const result = z
                .string()
                .min(3, "Username must be at least 3 characters")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="username" className="text-sm font-medium">
                Username{" "}
                <span className="text-destructive text-xs ml-1">*</span>
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
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
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
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium">
                Password{" "}
                <span className="text-destructive text-xs ml-1">*</span>
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
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="firstName" className="text-sm font-medium">
                First Name{" "}
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
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last Name{" "}
                <span className="text-destructive text-xs ml-1">*</span>
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

        {/* Phone Number */}
        <form.Field
          name="phoneNumber"
          validators={{
            onChange: ({ value }) => {
              // keep your loose client-side rule; real normalization happens later
              const result = z
                .string()
                .min(10, "Phone number must contain at least 10 digits")
                .regex(/\d/, "Phone number must contain digits")
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="phoneNumber" className="text-sm font-medium">
                Phone Number{" "}
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="phoneNumber"
                type="tel"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                required
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
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="streetAddress" className="text-sm font-medium">
                Street Address{" "}
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="streetAddress"
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

        {/* Address Line 2 */}
        <form.Field name="addressLine2">
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="addressLine2" className="text-sm font-medium">
                Address Line 2{" "}
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
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="city" className="text-sm font-medium">
                City <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <Input
                id="city"
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

        {/* State/Territory */}
        <form.Field
          name="stateOrTerritory"
          validators={{
            onChange: ({ value }) =>
              !value ? "State/Territory is required" : undefined,
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="stateOrTerritory" className="text-sm font-medium">
                State/Territory{" "}
                <span className="text-destructive text-xs ml-1">*</span>
              </label>
              <select
                id="stateOrTerritory"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  field.handleChange(e.target.value as typeof field.state.value)
                }
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select State/Territory</option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
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
                  /^\d{5}(-\d{4})?$/,
                  "Postal code must be 5 digits or ZIP+4 format",
                )
                .safeParse(value);
              return result.success
                ? undefined
                : result.error.issues[0]?.message;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1">
              <label htmlFor="postalCode" className="text-sm font-medium">
                Postal Code{" "}
                <span className="text-destructive text-xs ml-1">*</span>
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

        {/* Messages */}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {info ? <p className="text-sm text-blue-600">{info}</p> : null}

        {/* Submit */}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing up..." : "Sign up"}
        </Button>

        {/* Resend Confirmation */}
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="mx-auto"
            onClick={async () => {
              if (!preparedEmail) {
                setError("No email available to resend confirmation email to.");
                return;
              }
              const { error } = await supabase.auth.resend({
                type: "signup",
                email: preparedEmail,
              });
              if (error) setError(error.message);
              else
                setInfo(
                  "Confirmation email sent. Check your inbox (and spam).",
                );
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
    </div>
  );
}

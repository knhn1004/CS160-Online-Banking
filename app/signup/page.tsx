"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = () => {
    const errors: string[] = [];

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      errors.push("Please enter a valid email address");
    }

    // Password confirmation
    if (password !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    // Zip code validation
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      errors.push("Zip code must be 5 digits");
    }

    return errors;
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(", "));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Create auth user with Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.log(authError.message);
        setError(authError.message);
        return;
      }

      // POST user to database
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_user_id: authData.user?.id,
          email,
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || null,
          address: address || null,
          city: city || null,
          state: state || null,
          zip_code: parseInt(zipCode),
          role: "customer",
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Failed to create user profile");
      }

      // Redirect on success
      window.location.assign("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm Password
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="firstName" className="text-sm font-medium">
            First Name
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last Name
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium">
            Phone Number
          </label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="address" className="text-sm font-medium">
            Street Address
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St"
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="city" className="text-sm font-medium">
            City
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="San Francisco"
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="state" className="text-sm font-medium">
            State
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="state"
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="CA"
            maxLength={2}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="zipCode" className="text-sm font-medium">
            Zip Code
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="zipCode"
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            required
            maxLength={5}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing up..." : "Sign up"}
        </Button>
      </form>
    </div>
  );
}

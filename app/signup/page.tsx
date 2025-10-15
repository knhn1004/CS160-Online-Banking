"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  // Form Fields

  // In Create User POST Request
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateOrTerritory, setStateOrTerritory] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Password Fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = () => {
    const errors: string[] = [];

    // Password confirmation
    if (password !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    // Phone number validation (10 digits)
    // Strip all non-digit characters before validation
    const phoneDigits = phoneNumber.replace(/\D/g, "");
    if (!phoneNumber || phoneDigits.length !== 10) {
      errors.push("Phone number must contain exactly 10 digits");
    }

    // Postal code validation (ZIP or ZIP+4)
    // Strip spaces and validate
    const cleanedPostalCode = postalCode.replace(/\s/g, "");
    const postalCodeRegex = /^\d{5}(-?\d{4})?$/;
    if (!postalCode || !postalCodeRegex.test(cleanedPostalCode)) {
      errors.push(
        "Postal code must be 5 digits or ZIP+4 format (12345 or 12345-6789)",
      );
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
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.log(authError.message);
        setError(authError.message);
        return;
      }

      // POST user to database
      // Strip non-digit characters from phone number before sending
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");
      const response = await fetch("/api/users/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: `+1${cleanPhoneNumber}`,
          street_address: streetAddress,
          address_line_2: addressLine2 || null,
          city,
          state_or_territory: stateOrTerritory,
          postal_code: postalCode,
          country: "USA",
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
          <label htmlFor="username" className="text-sm font-medium">
            Username
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
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
          <label htmlFor="phoneNumber" className="text-sm font-medium">
            Phone Number
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            placeholder="555-123-4567 or (555) 123-4567"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="streetAddress" className="text-sm font-medium">
            Street Address
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="streetAddress"
            type="text"
            value={streetAddress}
            onChange={(e) => setStreetAddress(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="addressLine2" className="text-sm font-medium">
            Address Line 2
            <span className="text-gray-500 text-xs ml-1">(optional)</span>
          </label>
          <Input
            id="addressLine2"
            type="text"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
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
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="stateOrTerritory" className="text-sm font-medium">
            State/Territory
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <select
            id="stateOrTerritory"
            value={stateOrTerritory}
            onChange={(e) => setStateOrTerritory(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select State/Territory</option>
            <option value="AL">Alabama</option>
            <option value="AK">Alaska</option>
            <option value="AZ">Arizona</option>
            <option value="AR">Arkansas</option>
            <option value="CA">California</option>
            <option value="CO">Colorado</option>
            <option value="CT">Connecticut</option>
            <option value="DE">Delaware</option>
            <option value="DC">District of Columbia</option>
            <option value="FL">Florida</option>
            <option value="GA">Georgia</option>
            <option value="HI">Hawaii</option>
            <option value="ID">Idaho</option>
            <option value="IL">Illinois</option>
            <option value="IN">Indiana</option>
            <option value="IA">Iowa</option>
            <option value="KS">Kansas</option>
            <option value="KY">Kentucky</option>
            <option value="LA">Louisiana</option>
            <option value="ME">Maine</option>
            <option value="MD">Maryland</option>
            <option value="MA">Massachusetts</option>
            <option value="MI">Michigan</option>
            <option value="MN">Minnesota</option>
            <option value="MS">Mississippi</option>
            <option value="MO">Missouri</option>
            <option value="MT">Montana</option>
            <option value="NE">Nebraska</option>
            <option value="NV">Nevada</option>
            <option value="NH">New Hampshire</option>
            <option value="NJ">New Jersey</option>
            <option value="NM">New Mexico</option>
            <option value="NY">New York</option>
            <option value="NC">North Carolina</option>
            <option value="ND">North Dakota</option>
            <option value="OH">Ohio</option>
            <option value="OK">Oklahoma</option>
            <option value="OR">Oregon</option>
            <option value="PA">Pennsylvania</option>
            <option value="RI">Rhode Island</option>
            <option value="SC">South Carolina</option>
            <option value="SD">South Dakota</option>
            <option value="TN">Tennessee</option>
            <option value="TX">Texas</option>
            <option value="UT">Utah</option>
            <option value="VT">Vermont</option>
            <option value="VA">Virginia</option>
            <option value="WA">Washington</option>
            <option value="WV">West Virginia</option>
            <option value="WI">Wisconsin</option>
            <option value="WY">Wyoming</option>
            <option value="PR">Puerto Rico</option>
            <option value="GU">Guam</option>
            <option value="VI">Virgin Islands</option>
            <option value="AS">American Samoa</option>
            <option value="MP">Northern Mariana Islands</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="postalCode" className="text-sm font-medium">
            Postal Code
            <span className="text-red-500 text-xs ml-1">*</span>
          </label>
          <Input
            id="postalCode"
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            required
            placeholder="12345 or 12345-6789"
            maxLength={10}
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

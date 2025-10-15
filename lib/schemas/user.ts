import { z } from "zod";

// US State/Territory enum matching Prisma schema
export const USStateTerritorySchema = z.enum([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "PR",
  "GU",
  "VI",
  "AS",
  "MP",
]);

export type USStateTerritory = z.infer<typeof USStateTerritorySchema>;

// Login schema
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormData = z.infer<typeof LoginSchema>;

// Signup schema for user registration
export const SignupSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username must be at most 50 characters"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phoneNumber: z
      .string()
      .min(10, "Phone number must contain at least 10 digits")
      .regex(/\d/, "Phone number must contain digits"),
    streetAddress: z.string().min(1, "Street address is required"),
    addressLine2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    stateOrTerritory: USStateTerritorySchema,
    postalCode: z
      .string()
      .regex(
        /^\d{5}(-?\d{4})?$/,
        "Postal code must be 5 digits or ZIP+4 format",
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormData = z.infer<typeof SignupSchema>;

// Update profile schema (for authenticated users updating their profile)
export const UpdateProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone_number: z
    .string()
    .regex(
      /^\+1\d{10}$/,
      "Phone number must be in E.164 format (+1XXXXXXXXXX)",
    ),
  street_address: z.string().min(1, "Street address is required"),
  address_line_2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state_or_territory: USStateTerritorySchema,
  postal_code: z
    .string()
    .regex(/^\d{5}(-?\d{4})?$/, "Postal code must be 5 digits or ZIP+4 format"),
});

export type UpdateProfileData = z.infer<typeof UpdateProfileSchema>;

// User onboard schema (for creating user in database after Supabase auth)
export const UserOnboardSchema = z.object({
  username: z.string().min(1, "Username is required"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone_number: z
    .string()
    .regex(
      /^\+1\d{10}$/,
      "Phone number must be in E.164 format (+1XXXXXXXXXX)",
    ),
  street_address: z.string().min(1, "Street address is required"),
  address_line_2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state_or_territory: USStateTerritorySchema,
  postal_code: z
    .string()
    .regex(/^\d{5}(-?\d{4})?$/, "Postal code must be 5 digits or ZIP+4 format"),
  country: z.string().default("USA"),
  role: z.enum(["customer", "bank_manager"]).default("customer"),
});

export type UserOnboardData = z.infer<typeof UserOnboardSchema>;

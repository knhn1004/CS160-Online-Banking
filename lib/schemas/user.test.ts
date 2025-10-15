import { describe, it, expect } from "vitest";
import {
  LoginSchema,
  SignupSchema,
  UpdateProfileSchema,
  UserOnboardSchema,
  USStateTerritorySchema,
} from "./user";

describe("USStateTerritorySchema", () => {
  it("should validate valid state codes", () => {
    expect(USStateTerritorySchema.safeParse("CA").success).toBe(true);
    expect(USStateTerritorySchema.safeParse("NY").success).toBe(true);
    expect(USStateTerritorySchema.safeParse("TX").success).toBe(true);
  });

  it("should reject invalid state codes", () => {
    expect(USStateTerritorySchema.safeParse("XX").success).toBe(false);
    expect(USStateTerritorySchema.safeParse("").success).toBe(false);
    expect(USStateTerritorySchema.safeParse("california").success).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("should validate valid login credentials", () => {
    const result = LoginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = LoginSchema.safeParse({
      email: "invalid-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing password", () => {
    const result = LoginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("SignupSchema", () => {
  const validSignupData = {
    username: "testuser",
    email: "test@example.com",
    password: "Password123",
    confirmPassword: "Password123",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "5551234567",
    streetAddress: "123 Main St",
    addressLine2: "",
    city: "San Francisco",
    stateOrTerritory: "CA",
    postalCode: "94105",
  };

  it("should validate complete signup data", () => {
    const result = SignupSchema.safeParse(validSignupData);
    expect(result.success).toBe(true);
  });

  it("should reject username shorter than 3 characters", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      username: "ab",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
  });

  it("should reject weak password (no uppercase)", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject weak password (no number)", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      password: "Password",
      confirmPassword: "Password",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password shorter than 8 characters", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      password: "Pass1",
      confirmPassword: "Pass1",
    });
    expect(result.success).toBe(false);
  });

  it("should reject mismatched passwords", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      password: "Password123",
      confirmPassword: "Password456",
    });
    expect(result.success).toBe(false);
  });

  it("should reject phone number that is too short", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      phoneNumber: "123", // Too short
    });
    expect(result.success).toBe(false);
  });

  it("should accept phone number with formatting", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      phoneNumber: "(555) 123-4567",
    });
    expect(result.success).toBe(true);
  });

  it("should accept phone number with spaces", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      phoneNumber: "555 123 4567",
    });
    expect(result.success).toBe(true);
  });

  it("should accept phone number with dashes", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      phoneNumber: "555-123-4567",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid postal code", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      postalCode: "1234", // Too short
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid ZIP+4 format", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      postalCode: "94105-1234",
    });
    expect(result.success).toBe(true);
  });

  it("should accept optional address line 2", () => {
    const result = SignupSchema.safeParse({
      ...validSignupData,
      addressLine2: "Apt 4B",
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateProfileSchema", () => {
  const validProfileData = {
    first_name: "John",
    last_name: "Doe",
    phone_number: "+15551234567",
    street_address: "123 Main St",
    address_line_2: null,
    city: "San Francisco",
    state_or_territory: "CA",
    postal_code: "94105",
  };

  it("should validate complete profile data", () => {
    const result = UpdateProfileSchema.safeParse(validProfileData);
    expect(result.success).toBe(true);
  });

  it("should reject phone number without E.164 format", () => {
    const result = UpdateProfileSchema.safeParse({
      ...validProfileData,
      phone_number: "5551234567", // Missing +1
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional address_line_2", () => {
    const result = UpdateProfileSchema.safeParse({
      ...validProfileData,
      address_line_2: "Apt 4B",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const result = UpdateProfileSchema.safeParse({
      first_name: "John",
      // Missing other required fields
    });
    expect(result.success).toBe(false);
  });
});

describe("UserOnboardSchema", () => {
  const validOnboardData = {
    username: "testuser",
    first_name: "John",
    last_name: "Doe",
    email: "test@example.com",
    phone_number: "+15551234567",
    street_address: "123 Main St",
    address_line_2: null,
    city: "San Francisco",
    state_or_territory: "CA",
    postal_code: "94105",
    country: "USA",
    role: "customer" as const,
  };

  it("should validate complete onboard data", () => {
    const result = UserOnboardSchema.safeParse(validOnboardData);
    expect(result.success).toBe(true);
  });

  it("should accept bank_manager role", () => {
    const result = UserOnboardSchema.safeParse({
      ...validOnboardData,
      role: "bank_manager",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid role", () => {
    const result = UserOnboardSchema.safeParse({
      ...validOnboardData,
      role: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("should use default values", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { country, role, ...dataWithoutDefaults } = validOnboardData;
    const result = UserOnboardSchema.safeParse(dataWithoutDefaults);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe("USA");
      expect(result.data.role).toBe("customer");
    }
  });
});

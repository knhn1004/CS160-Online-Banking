/**
 * Centralized types and interfaces for the mobile app
 * Re-export commonly used types from various modules
 */

// Re-export API types
export type {
  InternalAccount,
  Transaction,
  UserProfile,
  ApiError,
} from "./api";

// Re-export ATM types
export type { AtmLocation, GeocodeResult } from "./atm";

// Re-export schema types
export type {
  USStateTerritory,
  LoginFormData,
  SignupFormData,
  UpdateProfileData,
  UserOnboardData,
} from "./schemas/user";

// Dashboard data type
import type { InternalAccount, Transaction, UserProfile } from "./api";

export interface DashboardData {
  accounts: InternalAccount[];
  transactions: Transaction[];
  totalBalance: number;
  userProfile: UserProfile | null;
}

// Profile form data type
export type ProfileFormData = Pick<
  UserProfile,
  | "first_name"
  | "last_name"
  | "phone_number"
  | "street_address"
  | "city"
  | "state_or_territory"
  | "postal_code"
> & {
  email: string;
  address_line_2: string; // Form uses string, API uses string | null
};


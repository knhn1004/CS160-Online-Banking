import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Determine the correct API URL based on platform and environment
const getDefaultApiUrl = () => {
  if (Platform.OS === "android") {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    // For physical devices, set EXPO_PUBLIC_API_URL in .env to your computer's IP
    return "http://10.0.2.2:3000";
  }
  
  // iOS uses localhost (works for simulator and physical device via USB)
  return "http://localhost:3000";
};

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  getDefaultApiUrl();

export interface InternalAccount {
  id: number;
  account_number: string;
  routing_number: string;
  account_type: "checking" | "savings";
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  internal_account_id: number;
  amount: number;
  transaction_type: string;
  direction: "inbound" | "outbound";
  status: "approved" | "denied" | "pending";
  created_at: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  street_address: string;
  address_line_2: string | null;
  city: string;
  state_or_territory: string;
  postal_code: string;
  country: string;
  created_at: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

class ApiClient {
  private onUnauthorizedCallback?: () => void;

  // Set callback for handling unauthorized errors
  setUnauthorizedHandler(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  private async getAuthToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await this.getAuthToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Handle 401 Unauthorized - trigger logout
      if (response.status === 401) {
        if (this.onUnauthorizedCallback) {
          this.onUnauthorizedCallback();
        }
      }

      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));
      throw new Error(
        error.message || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  }

  // Accounts API
  async getAccounts(): Promise<{ accounts: InternalAccount[] }> {
    return this.request<{ accounts: InternalAccount[] }>(
      "/api/accounts/internal",
    );
  }

  async createAccount(data: {
    account_type: "checking" | "savings";
    initial_deposit?: number;
  }): Promise<{ account: InternalAccount }> {
    return this.request<{ account: InternalAccount }>(
      "/api/accounts/internal",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  // Transactions API
  async getTransactions(
    limit?: number,
  ): Promise<{ transactions: Transaction[] }> {
    const params = limit ? `?limit=${limit}` : "";
    return this.request<{ transactions: Transaction[] }>(
      `/api/transactions${params}`,
    );
  }

  // Profile API
  async getProfile(): Promise<{ user: UserProfile }> {
    return this.request<{ user: UserProfile }>("/api/user/profile");
  }

  async updateProfile(data: {
    first_name: string;
    last_name: string;
    phone_number: string;
    street_address: string;
    address_line_2?: string | null;
    city: string;
    state_or_territory: string;
    postal_code: string;
  }): Promise<{ user: UserProfile }> {
    return this.request<{ user: UserProfile }>("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // User onboarding (creates user profile after Supabase signup)
  async onboardUser(data: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    street_address: string;
    address_line_2?: string | null;
    city: string;
    state_or_territory: string;
    postal_code: string;
    country?: string;
    role?: "customer" | "bank_manager";
  }): Promise<{ user: UserProfile }> {
    return this.request<{ user: UserProfile }>("/api/users/onboard", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();

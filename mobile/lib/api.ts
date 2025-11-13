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

      const error: ApiError & { error?: string; message?: string; details?: unknown } = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));
      
      // Prefer message field, fall back to error field, then ApiError.message
      let errorMessage = error.message || error.error || `HTTP error! status: ${response.status}`;
      
      // If there are validation details, try to extract more specific error messages
      if (error.details && Array.isArray(error.details)) {
        const detailMessages = error.details
          .map((detail: { path?: string[]; message?: string }) => {
            if (detail.path && detail.message) {
              const fieldName = detail.path[detail.path.length - 1];
              return `${fieldName}: ${detail.message}`;
            }
            return detail.message || String(detail);
          })
          .filter(Boolean);
        if (detailMessages.length > 0) {
          errorMessage = detailMessages.join(", ");
        }
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Accounts API
  async getAccounts(): Promise<{ accounts: InternalAccount[] }> {
    return this.request<{ accounts: InternalAccount[] }>(
      "/api/accounts/internal",
    );
  }

  async getAccountBalances(): Promise<{
    accounts: Array<{
      id: number;
      account_number: string;
      balance: number;
      created_at: string;
    }>;
    timestamp: string;
  }> {
    return this.request<{
      accounts: Array<{
        id: number;
        account_number: string;
        balance: number;
        created_at: string;
      }>;
      timestamp: string;
    }>("/api/accounts/balance");
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

  // API Keys API methods
  async getApiKeys(): Promise<{
    api_keys: Array<{
      id: number;
      key_prefix: string;
      account_id: number;
      account_number: string;
      account_type: "checking" | "savings";
      expires_at: string | null;
      is_active: boolean;
      created_at: string;
      last_used_at: string | null;
    }>;
  }> {
    return this.request<{
      api_keys: Array<{
        id: number;
        key_prefix: string;
        account_id: number;
        account_number: string;
        account_type: "checking" | "savings";
        expires_at: string | null;
        is_active: boolean;
        created_at: string;
        last_used_at: string | null;
      }>;
    }>("/api/api-keys");
  }

  async generateApiKey(data: {
    account_id: number;
    expires_at?: string | null;
  }): Promise<{
    api_key: string;
    key_id: number;
    key_prefix: string;
    account_id: number;
    account_number: string;
    expires_at: string | null;
    created_at: string;
  }> {
    return this.request<{
      api_key: string;
      key_id: number;
      key_prefix: string;
      account_id: number;
      account_number: string;
      expires_at: string | null;
      created_at: string;
    }>("/api/api-keys/generate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async revokeApiKey(keyId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/api-keys/${keyId}`, {
      method: "DELETE",
    });
  }

  async makeApiKeyTransaction(
    apiKey: string,
    transactionType: "credit" | "debit",
    amount: number,
    accountNumber?: string,
  ): Promise<{
    status: string;
    transaction_id?: number;
    amount: number;
  }> {
    // This endpoint uses API key auth, not JWT, so we don't use this.request()
    const queryParams = new URLSearchParams();
    queryParams.append("access_token", apiKey);
    const body: {
      transaction_type: "credit" | "debit";
      amount: number;
      account_number?: string;
    } = {
      transaction_type: transactionType,
      amount,
    };
    if (accountNumber) {
      body.account_number = accountNumber;
    }

    const response = await fetch(`${API_URL}/api/api-keys/transactions?${queryParams.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error: ApiError & { error?: string; message?: string } = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));
      const errorMessage = error.message || error.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Transfer API methods
  async transferInternal(data: {
    source_account_id: number;
    destination_account_id: number;
    amount: string; // Amount as string (e.g., "100.50")
  }): Promise<{
    success: boolean;
    message: string;
    transaction_id: number;
    amount: number;
  }> {
    return this.request<{
      success: boolean;
      message: string;
      transaction_id: number;
      amount: number;
    }>("/api/transfers/internal", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async transferExternal(data: {
    source_account_id: number;
    amount: string; // Amount as string
    recipient_email?: string;
    recipient_phone?: string;
    destination_account_id?: number;
  }): Promise<{
    success: boolean;
    message: string;
    transaction_id: number;
    amount: number;
    recipient_name: string;
  }> {
    return this.request<{
      success: boolean;
      message: string;
      transaction_id: number;
      amount: number;
      recipient_name: string;
    }>("/api/transfers/external", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async lookupRecipient(params: {
    email?: string;
    phone?: string;
  }): Promise<{
    found: boolean;
    user?: {
      id: number;
      email: string;
      phone_number: string;
      first_name: string;
      last_name: string;
      accounts: {
        id: number;
        account_type: string;
      }[];
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params.email) queryParams.append("email", params.email);
    if (params.phone) queryParams.append("phone", params.phone);

    return this.request<{
      found: boolean;
      user?: {
        id: number;
        email: string;
        phone_number: string;
        first_name: string;
        last_name: string;
        accounts: {
          id: number;
          account_type: string;
        }[];
      };
    }>(`/api/transfers/lookup?${queryParams.toString()}`);
  }

  // BillPay API methods
  async getBillPayees(params?: {
    business_name?: string;
  }): Promise<{
    payees: {
      id: number;
      business_name: string;
      email: string;
      phone: string;
      street_address: string;
      address_line_2: string | null;
      city: string;
      state_or_territory: string;
      postal_code: string;
      country: string;
      account_number: string;
      routing_number: string;
      is_active: boolean;
    }[];
  }> {
    const queryParams = new URLSearchParams();
    if (params?.business_name) {
      queryParams.append("business_name", params.business_name);
    }

    const queryString = queryParams.toString();
    return this.request<{
      payees: {
        id: number;
        business_name: string;
        email: string;
        phone: string;
        street_address: string;
        address_line_2: string | null;
        city: string;
        state_or_territory: string;
        postal_code: string;
        country: string;
        account_number: string;
        routing_number: string;
        is_active: boolean;
      }[];
    }>(`/api/billpay/payees${queryString ? `?${queryString}` : ""}`);
  }

  async createBillPayee(data: {
    business_name: string;
    email: string;
    phone: string;
    street_address: string;
    address_line_2?: string;
    city: string;
    state_or_territory: string;
    postal_code: string;
    country?: string;
    account_number: string;
    routing_number: string;
  }): Promise<{
    payee: {
      id: number;
      business_name: string;
      email: string;
      phone: string;
      street_address: string;
      address_line_2: string | null;
      city: string;
      state_or_territory: string;
      postal_code: string;
      country: string;
      account_number: string;
      routing_number: string;
      is_active: boolean;
    };
  }> {
    return this.request<{
      payee: {
        id: number;
        business_name: string;
        email: string;
        phone: string;
        street_address: string;
        address_line_2: string | null;
        city: string;
        state_or_territory: string;
        postal_code: string;
        country: string;
        account_number: string;
        routing_number: string;
        is_active: boolean;
      };
    }>("/api/billpay/payees", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getBillPayRules(): Promise<{
    rules: {
      id: number;
      user_id: number;
      source_internal_id: number;
      payee_id: number;
      amount: number;
      frequency: string;
      start_time: string;
      end_time: string | null;
    }[];
  }> {
    return this.request<{
      rules: {
        id: number;
        user_id: number;
        source_internal_id: number;
        payee_id: number;
        amount: number;
        frequency: string;
        start_time: string;
        end_time: string | null;
      }[];
    }>("/api/billpay/rules");
  }

  async createBillPayRule(data: {
    source_account_id: number;
    payee_id?: number;
    payee?: {
      business_name: string;
      email: string;
      phone: string;
      street_address: string;
      address_line_2?: string;
      city: string;
      state_or_territory: string;
      postal_code: string;
      country?: string;
      account_number: string;
      routing_number: string;
    };
    amount: string; // Amount as string
    frequency: string; // Cron expression
    start_time: string; // ISO datetime string
    end_time?: string; // ISO datetime string
  }): Promise<{
    rule: {
      id: number;
      user_id: number;
      source_internal_id: number;
      payee_id: number;
      amount: number;
      frequency: string;
      start_time: string;
      end_time: string | null;
    };
  }> {
    return this.request<{
      rule: {
        id: number;
        user_id: number;
        source_internal_id: number;
        payee_id: number;
        amount: number;
        frequency: string;
        start_time: string;
        end_time: string | null;
      };
    }>("/api/billpay/rules", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBillPayRule(
    ruleId: number,
    data: {
      source_account_id?: number;
      payee_id?: number;
      amount?: string; // Amount as string
      frequency?: string; // Cron expression
      start_time?: string; // ISO datetime string
      end_time?: string | null; // ISO datetime string or null
    },
  ): Promise<{
    rule: {
      id: number;
      user_id: number;
      source_internal_id: number;
      payee_id: number;
      amount: number;
      frequency: string;
      start_time: string;
      end_time: string | null;
    };
  }> {
    return this.request<{
      rule: {
        id: number;
        user_id: number;
        source_internal_id: number;
        payee_id: number;
        amount: number;
        frequency: string;
        start_time: string;
        end_time: string | null;
      };
    }>(`/api/billpay/rules/${ruleId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteBillPayRule(ruleId: number): Promise<void> {
    return this.request<void>(`/api/billpay/rules/${ruleId}`, {
      method: "DELETE",
    });
  }

  // Check deposit API methods
  async uploadCheckImage(file: {
    uri: string;
    type: string;
    name: string;
  }): Promise<{
    image_url: string;
    upload_id: string;
  }> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const formData = new FormData();
    // React Native FormData accepts file objects with uri property
    formData.append("file", {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    const response = await fetch(`${API_URL}/api/checks/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type - let fetch set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async depositCheck(data: {
    check_image_url: string;
    destination_account_number: string;
  }): Promise<{
    status: string;
    transaction_id?: number;
    amount?: number;
    validation_result?: {
      extracted_amount: number;
      routing_number?: string;
      account_number?: string;
      check_number?: string;
      payee_name?: string;
      payor_name?: string;
    };
    error?: string;
    message?: string;
  }> {
    return this.request<{
      status: string;
      transaction_id?: number;
      amount?: number;
      validation_result?: {
        extracted_amount: number;
        routing_number?: string;
        account_number?: string;
        check_number?: string;
        payee_name?: string;
        payor_name?: string;
      };
      error?: string;
      message?: string;
    }>("/api/checks/deposit", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Transfer history API methods
  async getTransferHistory(params?: {
    page?: number;
    limit?: number;
    type?: "internal_transfer" | "external_transfer" | "deposit";
    start_date?: string;
    end_date?: string;
  }): Promise<{
    transfers: {
      id: number;
      created_at: string;
      amount: number;
      status: "approved" | "denied";
      transaction_type: "internal_transfer" | "external_transfer" | "deposit";
      direction: "inbound" | "outbound";
      source_account_number?: string;
      destination_account_number?: string;
      external_routing_number?: string;
      external_account_number?: string;
      external_nickname?: string;
      check_image_url?: string;
      check_number?: string;
    }[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.type) queryParams.append("type", params.type);
    if (params?.start_date) queryParams.append("start_date", params.start_date);
    if (params?.end_date) queryParams.append("end_date", params.end_date);

    const queryString = queryParams.toString();
    const url = `/api/transfers/history${queryString ? `?${queryString}` : ""}`;

    return this.request<{
      transfers: {
        id: number;
        created_at: string;
        amount: number;
        status: "approved" | "denied";
        transaction_type: "internal_transfer" | "external_transfer";
        direction: "inbound" | "outbound";
        source_account_number?: string;
        destination_account_number?: string;
        external_routing_number?: string;
        external_account_number?: string;
        external_nickname?: string;
      }[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>(url, {
      method: "GET",
    });
  }
}

export const api = new ApiClient();

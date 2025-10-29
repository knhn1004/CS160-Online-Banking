import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardOverview } from "./dashboard-overview";
import { createClient } from "@/utils/supabase/client";

// Mock the Supabase client
vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
    },
  })),
}));

// Mock fetch
global.fetch = vi.fn();

const mockCreateClient = vi.mocked(createClient);

describe("DashboardOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state initially", () => {
    render(<DashboardOverview />);
    // While loading, the real content headings shouldn't be present
    expect(screen.queryByText(/Total Balance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Your Accounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recent Activity/i)).not.toBeInTheDocument();
  });

  it("should show error state when API fails", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "mock-token" } },
        }),
      },
    } as unknown as ReturnType<typeof createClient>;

    mockCreateClient.mockReturnValue(mockSupabase);
    vi.mocked(fetch).mockRejectedValue(new Error("API Error"));

    render(<DashboardOverview />);

    await waitFor(() => {
      expect(screen.getByText("API Error")).toBeInTheDocument();
    });
  });

  it("should display dashboard data when loaded successfully", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "mock-token" } },
        }),
      },
    } as unknown as ReturnType<typeof createClient>;

    const mockAccounts = [
      {
        id: 1,
        account_number: "12345678901234567",
        routing_number: "724722907",
        account_type: "checking",
        balance: 1000.0,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];

    const mockTransactions = [
      {
        id: 1,
        amount: 100.0,
        transaction_type: "deposit",
        direction: "inbound",
        status: "approved",
        created_at: "2024-01-01T00:00:00Z",
        internal_account_id: 1,
      },
    ];

    mockCreateClient.mockReturnValue(mockSupabase);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accounts: mockAccounts }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transactions: mockTransactions }),
      } as Response);

    render(<DashboardOverview />);

    await waitFor(() => {
      expect(screen.getAllByText("$1,000.00")).toHaveLength(2);
      expect(screen.getByText("1")).toBeInTheDocument(); // Active accounts count
      expect(screen.getByText(/checking Account/i)).toBeInTheDocument();
    });
  });

  /* add test back when GET accounts API is added */
  it("should show no accounts message when user has no accounts", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "mock-token" } },
        }),
      },
    } as unknown as ReturnType<typeof createClient>;

    mockCreateClient.mockReturnValue(mockSupabase);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accounts: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      } as Response);

    render(<DashboardOverview />);

    await waitFor(() => {
      expect(screen.getByText("No accounts found")).toBeInTheDocument();
    });
  });
});

/**
 * Unit tests for Dashboard/Home screen
 */

import { render, waitFor } from "@testing-library/react-native";
import DashboardScreen from "./index";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import {
  useAccounts,
  useTransactions,
  useProfile,
  useAccountBalancePolling,
} from "@/lib/queries";

// Mock dependencies
jest.mock("@/contexts/auth-context");
jest.mock("@/contexts/theme-context");
jest.mock("@/lib/queries");
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("DashboardScreen", () => {
  const mockUser = { id: "123", email: "test@example.com" };
  const mockAccounts = [
    {
      id: 1,
      account_number: "1234567890",
      routing_number: "123456789",
      account_type: "checking" as const,
      balance: 1000,
      is_active: true,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
    {
      id: 2,
      account_number: "0987654321",
      routing_number: "123456789",
      account_type: "savings" as const,
      balance: 5000,
      is_active: true,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
  ];

  const mockTransactions = [
    {
      id: 1,
      internal_account_id: 1,
      amount: 100,
      transaction_type: "deposit",
      direction: "inbound" as const,
      status: "approved" as const,
      created_at: "2024-01-01T10:00:00Z",
    },
  ];

  const mockProfile = {
    id: 1,
    username: "testuser",
    email: "test@example.com",
    first_name: "John",
    last_name: "Doe",
    phone_number: "+15551234567",
    street_address: "123 Main St",
    address_line_2: null,
    city: "San Francisco",
    state_or_territory: "CA",
    postal_code: "94105",
    country: "USA",
    created_at: "2024-01-01",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      session: { access_token: "token", user: mockUser },
    });
    (useTheme as jest.Mock).mockReturnValue({
      theme: "light",
    });
    (useAccounts as jest.Mock).mockReturnValue({
      data: { accounts: mockAccounts },
      isLoading: false,
      refetch: jest.fn(),
    });
    (useTransactions as jest.Mock).mockReturnValue({
      data: { transactions: mockTransactions },
      isLoading: false,
      refetch: jest.fn(),
    });
    (useProfile as jest.Mock).mockReturnValue({
      data: { user: mockProfile },
      isLoading: false,
      refetch: jest.fn(),
    });
    (useAccountBalancePolling as jest.Mock).mockImplementation(() => {});
  });

  it("should render dashboard with user data", async () => {
    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText("John Doe")).toBeTruthy();
      expect(getByText("Your Accounts")).toBeTruthy();
      expect(getByText("Recent Activity")).toBeTruthy();
    });
  });

  it("should enable polling when user is authenticated", () => {
    render(<DashboardScreen />);

    expect(useAccountBalancePolling).toHaveBeenCalledWith(5000, true);
  });

  it("should disable polling when user is not authenticated", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      session: null,
    });

    render(<DashboardScreen />);

    expect(useAccountBalancePolling).toHaveBeenCalledWith(5000, false);
  });

  it("should display total balance correctly", async () => {
    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      // Total balance should be 1000 + 5000 = 6000
      expect(getByText("$6,000.00")).toBeTruthy();
    });
  });

  it("should display active accounts count", async () => {
    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText("2")).toBeTruthy(); // 2 active accounts
    });
  });

  it("should show loading state initially", () => {
    (useAccounts as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: jest.fn(),
    });

    const { getByText } = render(<DashboardScreen />);

    expect(getByText("Loading...")).toBeTruthy();
  });

  it("should show greeting based on time of day", () => {
    const mockDate = new Date("2024-01-01T10:00:00Z"); // Morning
    jest.spyOn(global, "Date").mockImplementation(() => mockDate as unknown as Date);

    const { getByText } = render(<DashboardScreen />);

    expect(getByText("Good morning")).toBeTruthy();

    jest.restoreAllMocks();
  });

  it("should display empty state when no accounts", async () => {
    (useAccounts as jest.Mock).mockReturnValue({
      data: { accounts: [] },
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText("No accounts found")).toBeTruthy();
    });
  });

  it("should display empty state when no transactions", async () => {
    (useTransactions as jest.Mock).mockReturnValue({
      data: { transactions: [] },
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = render(<DashboardScreen />);

    await waitFor(() => {
      expect(getByText("No recent transactions")).toBeTruthy();
    });
  });

  it("should adjust font size for long names", () => {
    const longNameProfile = {
      ...mockProfile,
      first_name: "VeryLongFirstName",
      last_name: "VeryLongLastNameThatExceedsLimit",
    };

    (useProfile as jest.Mock).mockReturnValue({
      data: { user: longNameProfile },
      isLoading: false,
      refetch: jest.fn(),
    });

    const { getByText } = render(<DashboardScreen />);

    // Should render the long name
    expect(
      getByText("VeryLongFirstName VeryLongLastNameThatExceedsLimit"),
    ).toBeTruthy();
  });
});



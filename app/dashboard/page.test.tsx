import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardPage from "./page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock supabase client
const mockGetUser = vi.fn();
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// Mock AccountManagement component
vi.mock("./account-management", () => ({
  AccountManagement: () => <div>Account Management Component</div>,
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockGetUser.mockReturnValue(
      new Promise(() => {
        /* never resolves */
      }),
    );
    render(<DashboardPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to login when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("renders dashboard with tabs when user is authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    expect(screen.getByText("Account Management")).toBeInTheDocument();
    expect(
      screen.getByText("Account Management Component"),
    ).toBeInTheDocument();
  });

  it("renders tabs component with Account Management tab", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    const accountTab = screen.getByRole("tab", { name: /account management/i });
    expect(accountTab).toBeInTheDocument();
    expect(accountTab).toHaveAttribute("data-state", "active");
  });
});

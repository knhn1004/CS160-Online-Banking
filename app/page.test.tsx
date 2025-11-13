import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { vi } from "vitest";
import React from "react";
import Page from "./page";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock Supabase client with proper async handling
const mockGetUser = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

describe("Landing Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: user is not authenticated, resolves immediately
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  it("renders the main headline", async () => {
    render(<Page />);
    // Wait for async auth check to complete
    await waitFor(() => {
      expect(
        screen.getByText(/Simple, Secure, and Smart Banking/i),
      ).toBeInTheDocument();
    });
  });

  it("renders the Get Started button", async () => {
    render(<Page />);
    await waitFor(() => {
      const buttons = screen.getAllByText(/Get Started/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("renders the Sign In button", async () => {
    render(<Page />);
    await waitFor(
      () => {
        const buttons = screen.getAllByText(/Sign In/i);
        expect(buttons.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it("renders the footer", async () => {
    render(<Page />);
    // Wait for component to finish loading before checking footer
    await waitFor(() => {
      const footerText = screen.getAllByText(/CS160 Bank/i);
      expect(footerText.length).toBeGreaterThan(0);
    });
    // Check that footer copyright text exists
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it("renders feature cards", async () => {
    render(<Page />);
    // Wait for component to finish loading
    await waitFor(() => {
      // Use getAllByText since "Account Management" appears multiple times
      const accountManagement = screen.getAllByText(/Account Management/i);
      expect(accountManagement.length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Automated Bill Pay/i)).toBeInTheDocument();
    expect(screen.getByText(/ATM Locator/i)).toBeInTheDocument();
  });

  it("renders the CTA section", async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText(/Ready to get started\?/i)).toBeInTheDocument();
    });
  });

  it("renders dashboard button when authenticated", async () => {
    // Mock authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "test-user-id", email: "test@example.com" } },
      error: null,
    });

    render(<Page />);
    await waitFor(() => {
      const buttons = screen.getAllByText(/Go to Dashboard/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("cleans up auth subscription on unmount", async () => {
    const { unmount } = render(<Page />);
    await waitFor(() => {
      expect(
        screen.getByText(/Simple, Secure, and Smart Banking/i),
      ).toBeInTheDocument();
    });
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

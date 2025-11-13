import { render, screen } from "@testing-library/react";
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

// Mock Boxes component to avoid heavy rendering
vi.mock("@/components/ui/background-boxes", () => ({
  Boxes: () => <div data-testid="background-boxes" />,
}));

// Mock Supabase client with fast-resolving mocks
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
    // Use findByText which is optimized for async queries
    expect(
      await screen.findByText(/Simple, Secure, and Smart Banking/i),
    ).toBeInTheDocument();
  });

  it("renders the Get Started button", async () => {
    render(<Page />);
    // Wait for loading to complete and button to appear
    const buttons = await screen.findAllByText(/Get Started/i);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders the Sign In button", async () => {
    render(<Page />);
    const buttons = await screen.findAllByText(/Sign In/i);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders the footer", async () => {
    render(<Page />);
    // Wait for footer text to appear
    const footerText = await screen.findAllByText(/CS160 Bank/i);
    expect(footerText.length).toBeGreaterThan(0);
    // Check that footer copyright text exists
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it("renders feature cards", async () => {
    render(<Page />);
    // Wait for feature cards to appear
    const accountManagement = await screen.findAllByText(/Account Management/i);
    expect(accountManagement.length).toBeGreaterThan(0);
    expect(screen.getByText(/Automated Bill Pay/i)).toBeInTheDocument();
    expect(screen.getByText(/ATM Locator/i)).toBeInTheDocument();
  });

  it("renders the CTA section", async () => {
    render(<Page />);
    expect(
      await screen.findByText(/Ready to get started\?/i),
    ).toBeInTheDocument();
  });

  it("renders dashboard button when authenticated", async () => {
    // Mock authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "test-user-id", email: "test@example.com" } },
      error: null,
    });

    render(<Page />);
    const buttons = await screen.findAllByText(/Go to Dashboard/i);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("cleans up auth subscription on unmount", async () => {
    const { unmount } = render(<Page />);
    await screen.findByText(/Simple, Secure, and Smart Banking/i);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

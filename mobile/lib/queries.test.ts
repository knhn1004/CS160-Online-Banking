/**
 * Unit tests for TanStack Query hooks
 */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAccountBalancePolling } from "./queries";
import { api } from "./api";

// Mock the API module
jest.mock("./api", () => ({
  api: {
    setSession: jest.fn(),
    getAccountBalances: jest.fn(),
  },
}));

describe("useAccountBalancePolling", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it("should poll balances when enabled", async () => {
    const mockBalances = {
      accounts: [
        { id: 1, account_number: "12345", balance: 100, created_at: "2024-01-01" },
        { id: 2, account_number: "67890", balance: 200, created_at: "2024-01-01" },
      ],
      timestamp: "2024-01-01T00:00:00Z",
    };

    (api.getAccountBalances as jest.Mock).mockResolvedValue(mockBalances);

    renderHook(() => useAccountBalancePolling(1000, true), { wrapper });

    // Initial poll should happen immediately
    await waitFor(() => {
      expect(api.getAccountBalances).toHaveBeenCalledTimes(1);
    });

    // Fast-forward time and check that polling continues
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(api.getAccountBalances).toHaveBeenCalledTimes(2);
    });

    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(api.getAccountBalances).toHaveBeenCalledTimes(3);
    });
  });

  it("should not poll when disabled", async () => {
    renderHook(() => useAccountBalancePolling(1000, false), { wrapper });

    // Wait a bit to ensure no polling happens
    jest.advanceTimersByTime(5000);

    expect(api.getAccountBalances).not.toHaveBeenCalled();
  });

  it("should handle polling errors gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "debug").mockImplementation();
    (api.getAccountBalances as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );

    renderHook(() => useAccountBalancePolling(1000, true), { wrapper });

    await waitFor(() => {
      expect(api.getAccountBalances).toHaveBeenCalledTimes(1);
    });

    // Should have logged the error but not thrown (non-unauthorized errors are logged)
    expect(consoleSpy).toHaveBeenCalledWith(
      "Balance polling error:",
      new Error("Network error"),
    );

    consoleSpy.mockRestore();
  });

  it("should stop polling when component unmounts", async () => {
    const mockBalances = {
      accounts: [
        { id: 1, account_number: "12345", balance: 100, created_at: "2024-01-01" },
      ],
      timestamp: "2024-01-01T00:00:00Z",
    };

    (api.getAccountBalances as jest.Mock).mockResolvedValue(mockBalances);

    const { unmount } = renderHook(() => useAccountBalancePolling(1000, true), {
      wrapper,
    });

    await waitFor(() => {
      expect(api.getAccountBalances).toHaveBeenCalledTimes(1);
    });

    unmount();

    // After unmounting, polling should stop
    jest.advanceTimersByTime(5000);
    expect(api.getAccountBalances).toHaveBeenCalledTimes(1);
  });

  it("should invalidate queries when balances change", async () => {
    const initialBalances = {
      accounts: [
        { id: 1, account_number: "12345", balance: 100, created_at: "2024-01-01" },
      ],
      timestamp: "2024-01-01T00:00:00Z",
    };

    const updatedBalances = {
      accounts: [
        { id: 1, account_number: "12345", balance: 150, created_at: "2024-01-01" },
      ],
      timestamp: "2024-01-01T00:01:00Z",
    };

    (api.getAccountBalances as jest.Mock)
      .mockResolvedValueOnce(initialBalances)
      .mockResolvedValueOnce(updatedBalances);

    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useAccountBalancePolling(1000, true), { wrapper });

    // Wait for initial poll
    await waitFor(() => {
      expect(api.getAccountBalances).toHaveBeenCalledTimes(1);
    });

    // First poll should trigger invalidation (since previousBalances is empty)
    expect(invalidateSpy).toHaveBeenCalled();

    invalidateSpy.mockClear();

    // Advance time for second poll
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(api.getAccountBalances).toHaveBeenCalledTimes(2);
    });

    // Second poll should trigger invalidation because balance changed
    expect(invalidateSpy).toHaveBeenCalled();
  });
});


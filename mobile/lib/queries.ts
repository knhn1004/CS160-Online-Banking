/**
 * TanStack Query hooks for API calls
 * Provides typed hooks with proper caching and invalidation
 */

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { api } from "./api";
import type {
  InternalAccount,
  Transaction,
  UserProfile,
} from "./types";

// Query keys
export const queryKeys = {
  accounts: ["accounts"] as const,
  account: (id: number) => ["accounts", id] as const,
  transactions: (limit?: number) =>
    limit ? ["transactions", limit] : ["transactions"] as const,
  profile: ["profile"] as const,
  transferHistory: (params?: {
    page?: number;
    limit?: number;
    type?: "internal_transfer" | "external_transfer" | "deposit";
  }) => ["transferHistory", params] as const,
} as const;

// Accounts queries
export function useAccounts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => api.getAccounts(),
    enabled: !!session, // Only run when we have a session
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error) => {
      // Don't retry on 401/authentication errors - let the API client handle auth
      if (
        error instanceof Error &&
        (error.message.includes("Unauthorized") ||
          error.message.includes("Not authenticated"))
      ) {
        return false;
      }
      return failureCount < 1; // Default retry once
    },
  });
}

export function useAccount(id: number) {
  const { data: accountsData } = useAccounts();
  return {
    account: accountsData?.accounts.find((acc) => acc.id === id),
    isLoading: !accountsData,
  };
}

// Transactions queries
export function useTransactions(limit?: number) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.transactions(limit),
    queryFn: () => api.getTransactions(limit),
    enabled: !!session, // Only run when we have a session
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error) => {
      // Don't retry on 401/authentication errors - let the API client handle auth
      if (
        error instanceof Error &&
        (error.message.includes("Unauthorized") ||
          error.message.includes("Not authenticated"))
      ) {
        return false;
      }
      return failureCount < 1; // Default retry once
    },
  });
}

// Transfer history queries
export function useTransferHistory(params?: {
  page?: number;
  limit?: number;
  type?: "internal_transfer" | "external_transfer" | "deposit";
}) {
  return useQuery({
    queryKey: queryKeys.transferHistory(params),
    queryFn: () => api.getTransferHistory(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useTransferHistoryInfinite(params?: {
  limit?: number;
  type?: "internal_transfer" | "external_transfer" | "deposit";
}) {
  return useInfiniteQuery({
    queryKey: queryKeys.transferHistory(params),
    queryFn: ({ pageParam = 1 }) =>
      api.getTransferHistory({
        ...params,
        page: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const { page, total_pages } = lastPage.pagination;
      return page < total_pages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Profile queries
export function useProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => api.getProfile(),
    enabled: !!session, // Only run when we have a session
    staleTime: 60 * 1000, // 1 minute
    retry: (failureCount, error) => {
      // Don't retry on 401/authentication errors - let the API client handle auth
      // Profile might not exist for new users, so don't retry aggressively
      if (
        error instanceof Error &&
        (error.message.includes("Unauthorized") ||
          error.message.includes("Not authenticated"))
      ) {
        return false;
      }
      return failureCount < 1; // Default retry once
    },
  });
}

// Profile mutations
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof api.updateProfile>[0]) =>
      api.updateProfile(data),
    onSuccess: () => {
      // Invalidate profile and related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      // Also invalidate dashboard data that includes profile
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
    },
  });
}

// Account mutations
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof api.createAccount>[0]) =>
      api.createAccount(data),
    onSuccess: () => {
      // Invalidate accounts list
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      // Also invalidate transactions as balance changes
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
    },
  });
}

// API Key mutations
export function useMakeApiKeyTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      apiKey: string;
      transactionType: "credit" | "debit";
      amount: number;
      accountNumber?: string;
    }) =>
      api.makeApiKeyTransaction(
        params.apiKey,
        params.transactionType,
        params.amount,
        params.accountNumber,
      ),
    onSuccess: () => {
      // Invalidate queries to refresh balances and transactions after API key transaction
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: ["transferHistory"] });
    },
  });
}

// Polling hook for account balances (to detect external API key transactions)
export function useAccountBalancePolling(
  intervalMs: number = 5000,
  enabled: boolean = true,
) {
  const queryClient = useQueryClient();
  const previousBalancesRef = useRef<Map<number, number>>(new Map());
  const consecutiveErrorsRef = useRef(0);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Don't poll if disabled (e.g., user not authenticated)
    if (!enabled) {
      // Clear any existing interval
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      consecutiveErrorsRef.current = 0;
      return;
    }

    const pollBalances = async () => {
      try {
        const balanceData = await api.getAccountBalances();
        const currentBalances = new Map<number, number>();

        // Reset error counter on success
        consecutiveErrorsRef.current = 0;

        // Check if any balances have changed
        let hasChanged = false;
        for (const account of balanceData.accounts) {
          currentBalances.set(account.id, account.balance);
          const previousBalance = previousBalancesRef.current.get(account.id);
          if (
            previousBalance !== undefined &&
            previousBalance !== account.balance
          ) {
            hasChanged = true;
          }
        }

        // If balances changed, invalidate queries to refresh data
        if (hasChanged || previousBalancesRef.current.size === 0) {
          queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
          queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
          queryClient.invalidateQueries({ queryKey: ["transferHistory"] });
        }

        previousBalancesRef.current = currentBalances;
      } catch (error) {
        consecutiveErrorsRef.current += 1;
        
        // Check if error is unauthorized
        const isUnauthorized =
          error instanceof Error &&
          (error.message.includes("Unauthorized") ||
            error.message.includes("Not authenticated"));

        // Stop polling after 3 consecutive unauthorized errors
        // This prevents spamming when session has expired
        if (isUnauthorized && consecutiveErrorsRef.current >= 3) {
          console.debug(
            "Balance polling stopped: Too many unauthorized errors. Session may have expired.",
          );
          if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
          }
          return;
        }

        // Log other errors but continue polling
        if (!isUnauthorized) {
          console.debug("Balance polling error:", error);
        }
      }
    };

    // Poll immediately on mount
    pollBalances();

    // Set up interval polling
    intervalIdRef.current = setInterval(pollBalances, intervalMs);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      consecutiveErrorsRef.current = 0;
    };
  }, [intervalMs, queryClient, enabled]);
}


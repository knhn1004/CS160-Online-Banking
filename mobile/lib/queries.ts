/**
 * TanStack Query hooks for API calls
 * Provides typed hooks with proper caching and invalidation
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
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
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => api.getAccounts(),
    staleTime: 30 * 1000, // 30 seconds
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
  return useQuery({
    queryKey: queryKeys.transactions(limit),
    queryFn: () => api.getTransactions(limit),
    staleTime: 30 * 1000, // 30 seconds
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
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => api.getProfile(),
    staleTime: 60 * 1000, // 1 minute
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


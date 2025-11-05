/**
 * TanStack Query hooks for API calls
 * Provides typed hooks with proper caching and invalidation
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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


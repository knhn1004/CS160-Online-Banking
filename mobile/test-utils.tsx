import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/theme-context';
import { AuthProvider } from '@/contexts/auth-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock ToastProvider to avoid issues in tests
jest.mock('@/components/ui/alert-dialog', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Create a test query client with default options
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Don't cache in tests
        staleTime: 0, // Always stale in tests
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const queryClient = createTestQueryClient();
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
  
  const result = render(ui, { wrapper: Wrapper, ...options });
  
  // Properly cleanup QueryClient on unmount to prevent open handles
  const originalUnmount = result.unmount;
  result.unmount = () => {
    // Cancel all pending queries
    queryClient.cancelQueries();
    // Remove all queries from cache
    queryClient.removeQueries();
    // Clear all data
    queryClient.clear();
    // Reset all queries
    queryClient.resetQueries();
    // Close the query client (this stops all timers)
    queryClient.getQueryCache().clear();
    queryClient.getMutationCache().clear();
    originalUnmount();
  };
  
  return result;
}

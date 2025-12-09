/**
 * Unit tests for AuthContext
 */

import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth-context";
import { supabase } from "@/lib/supabase";

// Mock Supabase client
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

describe("AuthContext", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a new QueryClient for each test to ensure clean state
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  describe("initialization", () => {
    it("should initialize with loading state", () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      (supabase.auth.getSession as jest.Mock).mockReturnValue(
        Promise.resolve({ data: { session: null }, error: null }),
      );
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it("should restore session on mount if available", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      const mockSession = { user: mockUser, access_token: "token" };
      const mockSubscription = { unsubscribe: jest.fn() };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
    });

    it("should handle session restore errors gracefully", async () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid Refresh Token" },
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Session restore error:",
        "Invalid Refresh Token",
      );

      consoleSpy.mockRestore();
    });

    it("should handle unexpected session restore failures", async () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

      (supabase.auth.getSession as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Session restore failed:",
        new Error("Network error"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("signIn", () => {
    it("should sign in successfully", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      const mockSession = { user: mockUser, access_token: "token" };
      const mockSubscription = { unsubscribe: jest.fn() };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { error } = await result.current.signIn(
        "test@example.com",
        "password",
      );

      expect(error).toBeNull();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
      });
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.session).toEqual(mockSession);
      });
    });

    it("should handle sign in errors", async () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        error: { message: "Invalid credentials" },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { error } = await result.current.signIn(
        "test@example.com",
        "wrong",
      );

      expect(error).toEqual(new Error("Invalid credentials"));
    });
  });

  describe("signUp", () => {
    it("should sign up successfully", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      const mockSession = { user: mockUser, access_token: "token" };
      const mockSubscription = { unsubscribe: jest.fn() };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { error } = await result.current.signUp(
        "test@example.com",
        "password",
      );

      expect(error).toBeNull();
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
      });
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.session).toEqual(mockSession);
      });
    });

    it("should handle sign up errors", async () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        error: { message: "Email already exists" },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { error } = await result.current.signUp("test@example.com", "password");

      expect(error).toEqual(new Error("Email already exists"));
    });
  });

  describe("signOut", () => {
    it("should sign out successfully", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      const mockSession = { user: mockUser, access_token: "token" };
      const mockSubscription = { unsubscribe: jest.fn() };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify user is authenticated before sign out
      expect(result.current.user).toEqual(mockUser);

      await result.current.signOut();

      // Wait for state to update after sign out
      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      expect(result.current.session).toBeNull();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it("should handle sign out errors gracefully", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      const mockSession = { user: mockUser, access_token: "token" };
      const mockSubscription = { unsubscribe: jest.fn() };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: mockSubscription },
      });
      (supabase.auth.signOut as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw even if signOut fails
      await expect(result.current.signOut()).resolves.not.toThrow();

      // Wait for state to be cleared even on error
      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      expect(result.current.session).toBeNull();
    });
  });
});


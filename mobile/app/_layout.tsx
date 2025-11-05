import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { ToastProvider } from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    },
  },
});

export const unstable_settings = {
  initialRouteName: "(auth)",
};

function RootLayoutNav() {
  const { theme } = useTheme();
  const { user, loading, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Set up unauthorized handler to trigger logout on 401 errors
  useEffect(() => {
    api.setUnauthorizedHandler(async () => {
      await signOut();
      router.replace("/(auth)/login");
    });
  }, [signOut, router]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace("/(auth)/login");
    } else if (user && !inTabsGroup) {
      // Redirect to tabs if authenticated
      router.replace("/(tabs)/(home)");
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return null; // Or a loading screen
  }

  const navigationTheme = theme === "dark" ? DarkTheme : DefaultTheme;
  const colors = Colors[theme];

  // Customize navigation theme to match app colors
  const customTheme = {
    ...navigationTheme,
    colors: {
      ...navigationTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };

  return (
    <NavigationThemeProvider value={customTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <BottomSheetModalProvider>
              <ToastProvider>
                <AuthProvider>
                  <RootLayoutNav />
                </AuthProvider>
              </ToastProvider>
            </BottomSheetModalProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

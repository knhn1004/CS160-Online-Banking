import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@/contexts/theme-context';
import { AuthProvider } from '@/contexts/auth-context';
import { ToastProvider } from '@/components/ui/alert-dialog';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>{ui}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

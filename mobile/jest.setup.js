// Mock React Native modules
// Note: @testing-library/react-native v12.4+ includes built-in Jest matchers

// Suppress console errors during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    // Suppress React act() warnings
    if (
      typeof args[0] === 'string' &&
      args[0].includes('An update to') &&
      args[0].includes('was not wrapped in act(...)')
    ) {
      return;
    }
    // Suppress expected ATM API errors during tests
    if (
      (typeof args[0] === 'string' && args[0].includes('Error searching for ATMs')) ||
      (typeof args[0] === 'string' && args[0].includes('Error geocoding address')) ||
      (args.length > 1 && typeof args[1] === 'string' && args[1].includes('Error searching for ATMs')) ||
      (args.length > 1 && typeof args[1] === 'string' && args[1].includes('Error geocoding address'))
    ) {
      return;
    }
    // Call original error handler with proper context
    originalError.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock environment variables
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock Supabase client with synchronous auth methods
jest.mock('@supabase/supabase-js', () => {
  const mockSession = { user: null, session: null };
  const mockUnsubscribe = jest.fn();
  const mockSubscription = { unsubscribe: mockUnsubscribe };
  return {
    createClient: jest.fn(() => ({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: mockSession, error: null }),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: mockSubscription },
          unsubscribe: mockUnsubscribe,
        })),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        signInWithPassword: jest.fn().mockResolvedValue({ data: mockSession, error: null }),
        signUp: jest.fn().mockResolvedValue({ data: mockSession, error: null }),
      },
    })),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Stack: {
    Screen: ({ children }) => children,
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-toast-message', () => {
  const React = require('react');
  const MockToast = React.forwardRef(() => null);
  MockToast.displayName = 'MockToast';
  MockToast.show = jest.fn();
  return {
    __esModule: true,
    default: MockToast,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({
    status: 'granted',
  }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
    },
  }),
  Accuracy: {
    High: 'high',
  },
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
      }));
      return <View testID="webview" {...props} />;
    }),
  };
});

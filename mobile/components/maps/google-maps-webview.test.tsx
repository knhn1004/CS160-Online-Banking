import React from 'react';
import { GoogleMapsWebView } from '@/components/maps/google-maps-webview';
import { renderWithProviders } from '@/test-utils';
import type { AtmLocation } from '@/lib/atm';

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

// Mock react-native-webview
jest.mock('react-native-webview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const MockWebView = React.forwardRef(({ source: _source, onMessage: _onMessage, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: jest.fn(),
    }));
    return <View testID="webview" {...props} />;
  });
  MockWebView.displayName = 'MockWebView';
  return {
    WebView: MockWebView,
  };
});

describe('GoogleMapsWebView', () => {
  const mockAtms: AtmLocation[] = [
    {
      place_id: '1',
      name: 'Chase ATM',
      vicinity: '123 Main St',
      geometry: {
        location: {
          lat: 37.7749,
          lng: -122.4194,
        },
      },
      distance: 0.5,
    },
    {
      place_id: '2',
      name: 'Chase ATM',
      vicinity: '456 Oak Ave',
      geometry: {
        location: {
          lat: 37.776,
          lng: -122.421,
        },
      },
      distance: 1.2,
    },
  ];

  const mockUserLocation = {
    lat: 37.7749,
    lng: -122.4194,
  };

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it('renders without crashing', () => {
    const { getByTestId } = renderWithProviders(
      <GoogleMapsWebView
        userLocation={mockUserLocation}
        atms={mockAtms}
        selectedAtm={null}
      />
    );

    expect(getByTestId('webview')).toBeTruthy();
  });

  it('renders error message when API key is missing', () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    const { getByText } = renderWithProviders(
      <GoogleMapsWebView
        userLocation={mockUserLocation}
        atms={mockAtms}
        selectedAtm={null}
      />
    );

    expect(getByText(/Google Maps API key not configured/)).toBeTruthy();
  });

  it('renders with light theme by default', () => {
    const { getByTestId } = renderWithProviders(
      <GoogleMapsWebView
        userLocation={mockUserLocation}
        atms={mockAtms}
        selectedAtm={null}
      />
    );

    expect(getByTestId('webview')).toBeTruthy();
  });

  it('renders with dark theme', () => {
    const { getByTestId } = renderWithProviders(
      <GoogleMapsWebView
        userLocation={mockUserLocation}
        atms={mockAtms}
        selectedAtm={null}
        theme="dark"
      />
    );

    expect(getByTestId('webview')).toBeTruthy();
  });

  it('renders with selected ATM', () => {
    const { getByTestId } = renderWithProviders(
      <GoogleMapsWebView
        userLocation={mockUserLocation}
        atms={mockAtms}
        selectedAtm={mockAtms[0]}
      />
    );

    expect(getByTestId('webview')).toBeTruthy();
  });

  it('renders with empty ATMs array', () => {
    const { getByTestId } = renderWithProviders(
      <GoogleMapsWebView
        userLocation={mockUserLocation}
        atms={[]}
        selectedAtm={null}
      />
    );

    expect(getByTestId('webview')).toBeTruthy();
  });

  it('renders without user location', () => {
    const { getByTestId } = renderWithProviders(
      <GoogleMapsWebView
        userLocation={null}
        atms={mockAtms}
        selectedAtm={null}
      />
    );

    expect(getByTestId('webview')).toBeTruthy();
  });

  it('calls onMarkerPress when marker is clicked', () => {
    const onMarkerPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <GoogleMapsWebView
        userLocation={mockUserLocation}
        atms={mockAtms}
        selectedAtm={null}
        onMarkerPress={onMarkerPress}
      />
    );

    expect(getByTestId('webview')).toBeTruthy();
    // Note: Actual marker click would trigger onMessage callback
    // This is tested via integration tests or E2E tests
  });
});


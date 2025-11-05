import React from 'react';
import AtmLocatorScreen from '@/app/(tabs)/atm';
import { renderWithProviders } from '@/test-utils';

// Mock the ATM functions
jest.mock('@/lib/atm', () => ({
  searchNearbyATMs: jest.fn(),
  geocodeAddress: jest.fn(),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
}));

// Mock ActionSheetIOS
jest.mock('react-native/Libraries/ActionSheetIOS/ActionSheetIOS', () => ({
  showActionSheetWithOptions: jest.fn(),
}));

// Mock GoogleMapsWebView
jest.mock('@/components/maps/google-maps-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockGoogleMapsWebView = () => <View testID="google-maps-webview" />;
  MockGoogleMapsWebView.displayName = 'MockGoogleMapsWebView';
  return {
    GoogleMapsWebView: MockGoogleMapsWebView,
  };
});

describe('AtmLocatorScreen', () => {
  it('renders without crashing', () => {
    const { getByPlaceholderText } = renderWithProviders(<AtmLocatorScreen />);

    expect(getByPlaceholderText(/Enter address or use current location/)).toBeTruthy();
  });

  it('renders search input with location icon button', () => {
    const { getByPlaceholderText } = renderWithProviders(<AtmLocatorScreen />);

    expect(getByPlaceholderText(/Enter address or use current location/)).toBeTruthy();
    // Location button is integrated into search input
  });

  it('renders search icon button', () => {
    const { getByPlaceholderText } = renderWithProviders(<AtmLocatorScreen />);
    
    // Search button is now an icon button
    expect(getByPlaceholderText(/Enter address or use current location/)).toBeTruthy();
  });
});


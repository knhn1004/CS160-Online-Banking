import React from 'react';
import AtmLocatorScreen from '@/app/(tabs)/atm';
import { renderWithProviders } from '@/test-utils';

// Mock the ATM functions
jest.mock('@/lib/atm', () => ({
  searchNearbyATMs: jest.fn(),
  geocodeAddress: jest.fn(),
}));

// Mock GoogleMapsWebView
jest.mock('@/components/maps/google-maps-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GoogleMapsWebView: () => <View testID="google-maps-webview" />,
  };
});

describe('AtmLocatorScreen', () => {
  it('renders without crashing', () => {
    const { getByPlaceholderText } = renderWithProviders(<AtmLocatorScreen />);

    expect(getByPlaceholderText(/Enter address or use current location/)).toBeTruthy();
  });

  it('renders search input and button', () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<AtmLocatorScreen />);

    expect(getByPlaceholderText(/Enter address or use current location/)).toBeTruthy();
    expect(getByText('Search')).toBeTruthy();
  });

  it('renders location button', () => {
    const { getByText } = renderWithProviders(<AtmLocatorScreen />);

    expect(getByText('Use My Location')).toBeTruthy();
  });
});


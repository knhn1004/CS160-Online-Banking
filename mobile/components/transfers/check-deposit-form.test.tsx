import React from 'react';
import { CheckDepositForm } from './check-deposit-form';
import { renderWithProviders } from '@/test-utils';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

// Mock API
jest.mock('@/lib/api', () => ({
  api: {
    uploadCheckImage: jest.fn(),
    depositCheck: jest.fn(),
  },
}));

// Mock AccountSelector
jest.mock('./account-selector', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    AccountSelector: ({ selectedAccountId: _selectedAccountId, onSelect: _onSelect, label }: any) => (
      <View testID={`account-selector-${label}`}>
        <Text>{label}</Text>
      </View>
    ),
  };
});

const mockAccounts = [
  {
    id: 1,
    account_number: '1234567890',
    account_type: 'checking',
    balance: 1000.00,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

describe('CheckDepositForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAccounts hook
    require('@/lib/queries').useAccounts = jest.fn(() => ({
      data: { accounts: mockAccounts },
      isLoading: false,
    }));
  });

  it('renders without crashing', () => {
    const { getByTestId } = renderWithProviders(<CheckDepositForm />);
    
    expect(getByTestId('account-selector-Deposit To Account')).toBeTruthy();
  });

  it('renders image capture buttons', () => {
    const { getByText } = renderWithProviders(<CheckDepositForm />);
    
    expect(getByText('Take Photo')).toBeTruthy();
    expect(getByText('Select Photo')).toBeTruthy();
  });

  it('shows loading state when accounts are loading', () => {
    require('@/lib/queries').useAccounts = jest.fn(() => ({
      data: undefined,
      isLoading: true,
    }));

    const { getByText } = renderWithProviders(<CheckDepositForm />);
    
    expect(getByText('Loading accounts...')).toBeTruthy();
  });

  it('renders account selector', () => {
    const { getByTestId } = renderWithProviders(<CheckDepositForm />);
    
    expect(getByTestId('account-selector-Deposit To Account')).toBeTruthy();
  });

  it('renders image buttons when no image selected', () => {
    const { getByText } = renderWithProviders(<CheckDepositForm />);
    
    expect(getByText('Take Photo')).toBeTruthy();
    expect(getByText('Select Photo')).toBeTruthy();
  });
});


import React from 'react';
import { InternalTransferForm } from './internal-transfer-form';
import { renderWithProviders } from '@/test-utils';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

// Mock API
jest.mock('@/lib/api', () => ({
  api: {
    transferInternal: jest.fn(),
  },
}));

// Mock AccountSelector
jest.mock('./account-selector', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    AccountSelector: ({ selectedAccountId, onSelect: _onSelect, label }: any) => (
      <View testID={`account-selector-${label}`}>
        <Text>{label}</Text>
        <Text testID={`selected-${label}`}>{selectedAccountId || 'none'}</Text>
      </View>
    ),
  };
});

// Mock CurrencyInput
jest.mock('./currency-input', () => {
  const React = require('react');
  const { View, TextInput, Text } = require('react-native');
  return {
    CurrencyInput: ({ value, onChange, error }: any) => (
      <View testID="currency-input">
        <TextInput
          testID="amount-input"
          value={value}
          onChangeText={onChange}
          placeholder="Amount"
        />
        {error && <Text testID="amount-error">{error}</Text>}
      </View>
    ),
  };
});

// Mock TransferReviewScreen
jest.mock('./transfer-review-screen', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    TransferReviewScreen: ({ onConfirm, onBack }: any) => (
      <View testID="review-screen">
        <Text testID="confirm-button" onPress={onConfirm}>Confirm</Text>
        <Text testID="back-button" onPress={onBack}>Back</Text>
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
  {
    id: 2,
    account_number: '0987654321',
    account_type: 'savings',
    balance: 2000.00,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

describe('InternalTransferForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAccounts hook
    require('@/lib/queries').useAccounts = jest.fn(() => ({
      data: { accounts: mockAccounts },
      isLoading: false,
    }));
  });

  it('renders without crashing', () => {
    const { getByTestId } = renderWithProviders(<InternalTransferForm />);
    
    expect(getByTestId('account-selector-From Account')).toBeTruthy();
    expect(getByTestId('account-selector-To Account')).toBeTruthy();
    expect(getByTestId('currency-input')).toBeTruthy();
  });

  it('shows loading state when accounts are loading', () => {
    require('@/lib/queries').useAccounts = jest.fn(() => ({
      data: undefined,
      isLoading: true,
    }));

    const { getByText } = renderWithProviders(<InternalTransferForm />);
    
    expect(getByText('Loading accounts...')).toBeTruthy();
  });

  it('shows error when less than 2 accounts', () => {
    require('@/lib/queries').useAccounts = jest.fn(() => ({
      data: { accounts: [mockAccounts[0]] },
      isLoading: false,
    }));

    const { getByText } = renderWithProviders(<InternalTransferForm />);
    
    expect(getByText(/You need at least 2 active accounts/)).toBeTruthy();
  });

  it('renders form fields correctly', () => {
    const { getByTestId } = renderWithProviders(<InternalTransferForm />);
    
    expect(getByTestId('account-selector-From Account')).toBeTruthy();
    expect(getByTestId('account-selector-To Account')).toBeTruthy();
    expect(getByTestId('amount-input')).toBeTruthy();
  });
});


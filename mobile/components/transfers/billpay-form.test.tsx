import React from 'react';
import { BillPayForm } from './billpay-form';
import { renderWithProviders } from '@/test-utils';

// Mock expo-router - must be before component import
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock @react-navigation/native - must be before component import
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((callback) => {
    // Call the callback but don't require navigation context
    setTimeout(() => {
      try {
        callback();
      } catch {
        // Ignore navigation errors
      }
    }, 0);
    return () => {}; // Return cleanup function
  }),
}));

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

// Mock API
jest.mock('@/lib/api', () => ({
  api: {
    getBillPayees: jest.fn(() => Promise.resolve({ payees: [] })),
    createBillPayRule: jest.fn(),
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

// Mock PayeeSelector
jest.mock('./payee-selector', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    PayeeSelector: ({ selectedPayeeId: _selectedPayeeId, onSelect: _onSelect, label }: any) => (
      <View testID={`payee-selector`}>
        <Text>{label}</Text>
      </View>
    ),
  };
});

// Mock FrequencySelector
jest.mock('./frequency-selector', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    FrequencySelector: ({ selectedFrequency: _selectedFrequency, onSelect: _onSelect, label }: any) => (
      <View testID={`frequency-selector`}>
        <Text>{label}</Text>
      </View>
    ),
  };
});

// Mock CurrencyInput
jest.mock('./currency-input', () => {
  const React = require('react');
  const { View, TextInput } = require('react-native');
  return {
    CurrencyInput: ({ value, onChange }: any) => (
      <View testID="currency-input">
        <TextInput
          testID="amount-input"
          value={value}
          onChangeText={onChange}
          placeholder="Amount"
        />
      </View>
    ),
  };
});

// Mock TransferReviewScreen
jest.mock('./transfer-review-screen', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    TransferReviewScreen: ({ onConfirm }: any) => (
      <View testID="review-screen">
        <Text testID="confirm-button" onPress={onConfirm}>Confirm</Text>
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

describe('BillPayForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAccounts hook
    require('@/lib/queries').useAccounts = jest.fn(() => ({
      data: { accounts: mockAccounts },
      isLoading: false,
    }));
  });

  it('renders without crashing', () => {
    const { getByTestId } = renderWithProviders(<BillPayForm />);
    
    expect(getByTestId('account-selector-From Account')).toBeTruthy();
  });

  it('renders payee selector', () => {
    const { getByTestId } = renderWithProviders(<BillPayForm />);
    
    expect(getByTestId('payee-selector')).toBeTruthy();
  });

  it('renders frequency selector', () => {
    const { getByTestId } = renderWithProviders(<BillPayForm />);
    
    expect(getByTestId('frequency-selector')).toBeTruthy();
  });

  it('shows loading state when accounts are loading', () => {
    require('@/lib/queries').useAccounts = jest.fn(() => ({
      data: undefined,
      isLoading: true,
    }));

    const { getByText } = renderWithProviders(<BillPayForm />);
    
    expect(getByText('Loading accounts...')).toBeTruthy();
  });

  it('renders all form fields correctly', () => {
    const { getByTestId } = renderWithProviders(<BillPayForm />);
    
    expect(getByTestId('account-selector-From Account')).toBeTruthy();
    expect(getByTestId('payee-selector')).toBeTruthy();
    expect(getByTestId('frequency-selector')).toBeTruthy();
    expect(getByTestId('amount-input')).toBeTruthy();
  });
});


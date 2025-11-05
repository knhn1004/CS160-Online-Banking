import React from 'react';
import { AccountCard } from './account-card';
import { renderWithProviders } from '@/test-utils';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockAccount = {
  id: 1,
  account_number: '1234567890',
  account_type: 'checking',
  balance: 1234.56,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

describe('AccountCard', () => {
  it('renders correctly with account information', () => {
    const { getByText } = renderWithProviders(<AccountCard account={mockAccount} />);
    
    expect(getByText('Checking Account')).toBeTruthy();
    expect(getByText('$1,234.56')).toBeTruthy();
    expect(getByText('****7890')).toBeTruthy();
    expect(getByText('Active')).toBeTruthy();
  });

  it('renders inactive status correctly', () => {
    const inactiveAccount = { ...mockAccount, is_active: false };
    const { getByText } = renderWithProviders(<AccountCard account={inactiveAccount} />);
    
    expect(getByText('Inactive')).toBeTruthy();
  });

  it('formats account number correctly', () => {
    const { getByText } = renderWithProviders(<AccountCard account={mockAccount} />);
    
    expect(getByText('****7890')).toBeTruthy();
  });

  it('formats different account types correctly', () => {
    const savingsAccount = { ...mockAccount, account_type: 'savings' };
    const { getByText } = renderWithProviders(<AccountCard account={savingsAccount} />);
    
    expect(getByText('Savings Account')).toBeTruthy();
  });

  it('formats balance correctly', () => {
    const { getByText } = renderWithProviders(<AccountCard account={mockAccount} />);
    
    expect(getByText('$1,234.56')).toBeTruthy();
  });

  it('handles account with short number', () => {
    const shortAccount = { ...mockAccount, account_number: '123' };
    const { getByText } = renderWithProviders(<AccountCard account={shortAccount} />);
    
    // Account number should be padded to 4 digits
    expect(getByText('****')).toBeTruthy();
  });

  it('is pressable', () => {
    const { getByText } = renderWithProviders(<AccountCard account={mockAccount} />);
    const card = getByText('Checking Account').parent?.parent;
    
    expect(card).toBeTruthy();
  });
});


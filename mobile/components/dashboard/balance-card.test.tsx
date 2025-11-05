import React from 'react';
import { BalanceCard } from './balance-card';
import { renderWithProviders } from '@/test-utils';

describe('BalanceCard', () => {
  it('renders correctly with balance', () => {
    const { getByText } = renderWithProviders(<BalanceCard balance={1234.56} />);
    
    expect(getByText('Total Balance')).toBeTruthy();
    expect(getByText('$1,234.56')).toBeTruthy();
  });

  it('formats zero balance correctly', () => {
    const { getByText } = renderWithProviders(<BalanceCard balance={0} />);
    
    expect(getByText('$0.00')).toBeTruthy();
  });

  it('formats large balance correctly', () => {
    const { getByText } = renderWithProviders(<BalanceCard balance={1000000.99} />);
    
    expect(getByText('$1,000,000.99')).toBeTruthy();
  });

  it('formats negative balance correctly', () => {
    const { getByText } = renderWithProviders(<BalanceCard balance={-123.45} />);
    
    expect(getByText('-$123.45')).toBeTruthy();
  });
});


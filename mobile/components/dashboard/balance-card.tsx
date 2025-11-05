import { StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface BalanceCardProps {
  balance: number;
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const formatCurrency = (amount: number) => {
    // Balance is in cents, convert to dollars
    const dollars = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  };

  return (
    <ThemedView style={styles.card}>
      <ThemedText style={styles.label}>Total Balance</ThemedText>
      <ThemedText style={styles.balance}>{formatCurrency(balance)}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
    minHeight: 80,
  },
  label: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  balance: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#16a34a',
    lineHeight: 36,
  },
});


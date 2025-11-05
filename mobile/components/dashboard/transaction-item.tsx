import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Transaction } from '@/lib/api';

interface TransactionItemProps {
  transaction: Transaction;
  accountNumber: string;
}

export function TransactionItem({ transaction, accountNumber }: TransactionItemProps) {
  const formatCurrency = (amount: number) => {
    // Amount is in cents, convert to dollars
    const dollars = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCensoredAccountNumber = (accountNumber: string) => {
    if (!accountNumber || accountNumber.length < 4) {
      return '****';
    }
    // Show only last 4 digits, pad with zeros if needed
    const lastFour = accountNumber.slice(-4).padStart(4, '0');
    return `****${lastFour}`;
  };

  const formatTransactionType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const isInbound = transaction.direction === 'inbound';
  const amountColor = isInbound ? '#16a34a' : '#ea580c';

  return (
    <ThemedView style={styles.card}>
      <View style={styles.topRow}>
        <ThemedText style={styles.transactionType}>
          {formatTransactionType(transaction.transaction_type)}
        </ThemedText>
        <ThemedText style={[styles.amount, { color: amountColor }]}>
          {isInbound ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount))}
        </ThemedText>
      </View>
      <View style={styles.bottomRow}>
        <ThemedText style={styles.metaText}>
          {getCensoredAccountNumber(accountNumber)} • {transaction.status} • {formatDate(transaction.created_at)}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    opacity: 0.6,
  },
});


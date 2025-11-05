import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { api, type InternalAccount, type Transaction } from '@/lib/api';
import { TransactionItem } from '@/components/dashboard/transaction-item';

export default function AccountDetailScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [account, setAccount] = useState<InternalAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccountData = useCallback(async () => {
    try {
      setError(null);
      const accountId = parseInt(params.accountId as string);
      
      const [accountsRes, transactionsRes] = await Promise.all([
        api.getAccounts(),
        api.getTransactions(50),
      ]);

      const foundAccount = accountsRes.accounts.find((acc) => acc.id === accountId);
      if (!foundAccount) {
        setError('Account not found');
        return;
      }

      const accountTransactions = transactionsRes.transactions.filter(
        (tx) => tx.internal_account_id === accountId
      );

      setAccount(foundAccount);
      setTransactions(accountTransactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account details');
    } finally {
      setLoading(false);
    }
  }, [params.accountId]);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  const formatCurrency = (amount: number) => {
    const dollars = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  };

  const getCensoredAccountNumber = (accountNumber: string) => {
    if (!accountNumber || accountNumber.length < 4) {
      return '****';
    }
    const lastFour = accountNumber.slice(-4).padStart(4, '0');
    return `****${lastFour}`;
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Account Details', headerShown: true }} />
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (error || !account) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ title: 'Account Details', headerShown: true }} />
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error || 'Account not found'}</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  const accountType = account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `${accountType} Account`, headerShown: true }} />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}>
        {/* Account Header */}
        <ThemedView style={styles.header}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.accountType}>{accountType} Account</ThemedText>
            <View style={[
              styles.statusBadge,
              { backgroundColor: account.is_active ? '#d1fae5' : '#fef3c7' }
            ]}>
              <ThemedText style={[
                styles.statusText,
                { color: account.is_active ? '#065f46' : '#92400e' }
              ]}>
                {account.is_active ? 'Active' : 'Inactive'}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={styles.accountNumber}>
            {getCensoredAccountNumber(account.account_number)}
          </ThemedText>
          <ThemedText style={styles.balance}>{formatCurrency(account.balance)}</ThemedText>
        </ThemedView>

        {/* Account Details */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Account Information
          </ThemedText>
          <ThemedView style={styles.infoCard}>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Account Number</ThemedText>
              <ThemedText style={styles.infoValue}>
                {getCensoredAccountNumber(account.account_number)}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Routing Number</ThemedText>
              <ThemedText style={styles.infoValue}>
                {account.routing_number.slice(0, 2)}***{account.routing_number.slice(-2)}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Account Type</ThemedText>
              <ThemedText style={styles.infoValue}>{accountType}</ThemedText>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <ThemedText style={styles.infoLabel}>Status</ThemedText>
              <ThemedText style={styles.infoValue}>
                {account.is_active ? 'Active' : 'Inactive'}
              </ThemedText>
            </View>
          </ThemedView>
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Transaction History
          </ThemedText>
          {transactions.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>No transactions yet</ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((transaction, index) => (
                <View key={transaction.id} style={index > 0 && { marginTop: 8 }}>
                  <TransactionItem
                    transaction={transaction}
                    accountNumber={account.account_number}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#d1fae5',
    marginBottom: 24,
    minHeight: 140,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accountType: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  accountNumber: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
  },
  balance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#16a34a',
    lineHeight: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionsList: {
    marginTop: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.6,
    fontSize: 14,
  },
});


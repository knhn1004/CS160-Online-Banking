import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { api, type InternalAccount, type Transaction } from '@/lib/api';
import { BalanceCard } from '@/components/dashboard/balance-card';
import { AccountCard } from '@/components/dashboard/account-card';
import { TransactionItem } from '@/components/dashboard/transaction-item';

interface DashboardData {
  accounts: InternalAccount[];
  transactions: Transaction[];
  totalBalance: number;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const [accountsRes, transactionsRes] = await Promise.all([
        api.getAccounts(),
        api.getTransactions(5),
      ]);

      const totalBalance = accountsRes.accounts.reduce((sum, acc) => sum + acc.balance, 0);

      setData({
        accounts: accountsRes.accounts,
        transactions: transactionsRes.transactions,
        totalBalance,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !data) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.content}>
        {error && (
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </ThemedView>
        )}

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <BalanceCard balance={data?.totalBalance || 0} />
          <View style={styles.activeAccountsCard}>
            <ThemedText style={styles.cardLabel}>Active Accounts</ThemedText>
            <ThemedText style={styles.cardValue}>
              {data?.accounts.filter((acc) => acc.is_active).length || 0}
            </ThemedText>
          </View>
        </View>

        {/* Accounts Overview */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Your Accounts
          </ThemedText>
          {!data || data.accounts.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>No accounts found</ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.accountsList}>
              {data.accounts.map((account, index) => (
                <View key={account.id} style={index > 0 && { marginTop: 12 }}>
                  <AccountCard account={account} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.recentActivityContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Recent Activity
          </ThemedText>
          {!data || data.transactions.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>No recent transactions</ThemedText>
            </ThemedView>
          ) : (
            <ScrollView
              style={styles.transactionsScrollView}
              contentContainerStyle={styles.transactionsList}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              showsVerticalScrollIndicator={true}>
              {data.transactions.map((transaction, index) => {
                const account = data.accounts.find(
                  (acc) => acc.id === transaction.internal_account_id
                );
                return (
                  <View key={transaction.id} style={index > 0 && { marginTop: 8 }}>
                    <TransactionItem
                      transaction={transaction}
                      accountNumber={account?.account_number || ''}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  activeAccountsCard: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    marginLeft: 12,
    minHeight: 80,
  },
  cardLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  accountsList: {
    marginTop: 8,
  },
  recentActivityContainer: {
    flex: 1,
    marginTop: 8,
  },
  transactionsScrollView: {
    flex: 1,
  },
  transactionsList: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.6,
    fontSize: 14,
  },
});

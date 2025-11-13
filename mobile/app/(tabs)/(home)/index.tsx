import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { useAccounts, useTransactions, useProfile, useAccountBalancePolling } from "@/lib/queries";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { AccountCard } from "@/components/dashboard/account-card";
import { TransactionItem } from "@/components/dashboard/transaction-item";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = Colors[theme];

  // Poll account balances every 5 seconds to detect external API key transactions
  useAccountBalancePolling(5000);

  // Use TanStack Query hooks
  const {
    data: accountsData,
    isLoading: accountsLoading,
    refetch: refetchAccounts,
  } = useAccounts();
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useTransactions(5);
  const {
    data: profileData,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useProfile();

  const accounts = useMemo(
    () => accountsData?.accounts || [],
    [accountsData?.accounts],
  );
  const transactions = transactionsData?.transactions || [];
  const userProfile = profileData?.user || null;

  const isLoading = accountsLoading || transactionsLoading || profileLoading;
  const isRefreshing = false; // TanStack Query handles this internally

  const onRefresh = () => {
    refetchAccounts();
    refetchTransactions();
    refetchProfile();
  };

  const totalBalance = useMemo(
    () => accounts.reduce((sum, acc) => sum + acc.balance, 0),
    [accounts],
  );

  if (isLoading && accounts.length === 0) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getUserDisplayName = () => {
    if (!userProfile) return "";
    const { first_name, last_name } = userProfile;
    return `${first_name} ${last_name}`.trim();
  };

  const getNameFontSize = (name: string) => {
    const length = name.length;
    if (length <= 15) return 28;
    if (length <= 25) return 24;
    if (length <= 35) return 20;
    return 18;
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.content}>
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <ThemedText style={styles.greeting}>{getGreeting()}</ThemedText>
          {userProfile && (
            <ThemedText
              style={[
                styles.userName,
                { fontSize: getNameFontSize(getUserDisplayName()) },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit={true}
            >
              {getUserDisplayName()}
            </ThemedText>
          )}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <BalanceCard balance={totalBalance} />
          <View
            style={[
              styles.activeAccountsCard,
              {
                backgroundColor:
                  theme === "dark" ? colors.accent + "20" : "#f0f9ff",
                borderColor:
                  theme === "dark" ? colors.accent + "40" : "#e0e7ff",
              },
            ]}
          >
            <ThemedText style={styles.cardLabel}>Active Accounts</ThemedText>
            <ThemedText style={styles.cardValue}>
              {accounts.filter((acc) => acc.is_active).length}
            </ThemedText>
          </View>
        </View>

        {/* Accounts Overview */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Your Accounts
          </ThemedText>
          {accounts.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>
                No accounts found
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.accountsList}>
              {accounts.map((account, index) => (
                <View key={account.id} style={index > 0 && { marginTop: 6 }}>
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
          {transactions.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>
                No recent transactions
              </ThemedText>
            </ThemedView>
          ) : (
            <ScrollView
              style={styles.transactionsScrollView}
              contentContainerStyle={styles.transactionsList}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                />
              }
              showsVerticalScrollIndicator={true}
            >
              {transactions.map((transaction, index) => {
                const account = accounts.find(
                  (acc) => acc.id === transaction.internal_account_id,
                );
                return (
                  <View
                    key={transaction.id}
                    style={index > 0 && { marginTop: 8 }}
                  >
                    <TransactionItem
                      transaction={transaction}
                      accountNumber={account?.account_number || ""}
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
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  activeAccountsCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
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
    fontWeight: "bold",
    lineHeight: 32,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 6,
    fontSize: 16,
  },
  accountsList: {
    marginTop: 4,
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
    alignItems: "center",
  },
  emptyText: {
    opacity: 0.6,
    fontSize: 14,
  },
  greetingSection: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: "bold",
    lineHeight: 36,
  },
});

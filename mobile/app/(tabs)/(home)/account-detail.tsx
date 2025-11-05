import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { useAccounts, useTransactions } from "@/lib/queries";
import { TransactionItem } from "@/components/dashboard/transaction-item";

export default function AccountDetailScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const accountId = parseInt(params.accountId as string);

  // Use TanStack Query hooks
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const { data: transactionsData, isLoading: transactionsLoading } =
    useTransactions(50);

  const account = useMemo(() => {
    return accountsData?.accounts.find((acc) => acc.id === accountId);
  }, [accountsData?.accounts, accountId]);

  const transactions = useMemo(() => {
    if (!transactionsData?.transactions) return [];
    return transactionsData.transactions.filter(
      (tx) => tx.internal_account_id === accountId,
    );
  }, [transactionsData?.transactions, accountId]);

  const isLoading = accountsLoading || transactionsLoading;
  const error = !account && !isLoading ? "Account not found" : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getCensoredAccountNumber = (accountNumber: string) => {
    if (!accountNumber || accountNumber.length < 4) {
      return "****";
    }
    const lastFour = accountNumber.slice(-4).padStart(4, "0");
    return `****${lastFour}`;
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Toast.show({
        type: "success",
        text1: "Copied",
        text2: `${label} copied to clipboard`,
      });
    } catch {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to copy to clipboard",
      });
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: "Account Details",
            headerShown: true,
            headerBackTitle: "",
            headerTintColor: colors.text,
            headerBackVisible: true,
          }}
        />
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (error || !account) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            title: "Account Details",
            headerShown: true,
            headerBackTitle: "",
            headerTintColor: colors.text,
            headerBackVisible: true,
          }}
        />
        <ThemedView
          style={[
            styles.errorContainer,
            {
              backgroundColor: colors.destructive + "20",
              borderColor: colors.destructive,
            },
          ]}
        >
          <ThemedText style={[styles.errorText, { color: colors.destructive }]}>
            {error || "Account not found"}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  const accountType =
    account.account_type.charAt(0).toUpperCase() +
    account.account_type.slice(1);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: `${accountType} Account`,
          headerShown: true,
          headerBackTitle: "",
          headerTintColor: colors.text,
          headerBackVisible: true,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Account Header */}
        <ThemedView
          style={[
            styles.header,
            {
              backgroundColor:
                theme === "dark" ? colors.success + "20" : "#f0fdf4",
              borderColor: theme === "dark" ? colors.success + "40" : "#d1fae5",
            },
          ]}
        >
          <View style={styles.headerRow}>
            <ThemedText style={styles.accountType}>
              {accountType} Account
            </ThemedText>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: account.is_active ? "#d1fae5" : "#fef3c7" },
              ]}
            >
              <ThemedText
                style={[
                  styles.statusText,
                  { color: account.is_active ? "#065f46" : "#92400e" },
                ]}
              >
                {account.is_active ? "Active" : "Inactive"}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={styles.accountNumber}>
            {getCensoredAccountNumber(account.account_number)}
          </ThemedText>
          <ThemedText style={[styles.balance, { color: colors.success }]}>
            {formatCurrency(account.balance)}
          </ThemedText>
        </ThemedView>

        {/* Account Details */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Account Information
          </ThemedText>
          <ThemedView
            style={[
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[styles.infoRow, { borderBottomColor: colors.border }]}
              onPress={() =>
                handleCopy(account.account_number, "Account number")
              }
              activeOpacity={0.7}
            >
              <ThemedText style={styles.infoLabel}>Account Number</ThemedText>
              <View style={styles.infoValueRow}>
                <ThemedText style={styles.infoValue}>
                  {account.account_number}
                </ThemedText>
                <IconSymbol
                  name="doc.on.doc"
                  size={18}
                  color={colors.icon}
                  style={styles.copyIcon}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.infoRow, { borderBottomColor: colors.border }]}
              onPress={() =>
                handleCopy(account.routing_number, "Routing number")
              }
              activeOpacity={0.7}
            >
              <ThemedText style={styles.infoLabel}>Routing Number</ThemedText>
              <View style={styles.infoValueRow}>
                <ThemedText style={styles.infoValue}>
                  {account.routing_number}
                </ThemedText>
                <IconSymbol
                  name="doc.on.doc"
                  size={18}
                  color={colors.icon}
                  style={styles.copyIcon}
                />
              </View>
            </TouchableOpacity>
            <View
              style={[styles.infoRow, { borderBottomColor: colors.border }]}
            >
              <ThemedText style={styles.infoLabel}>Account Type</ThemedText>
              <ThemedText style={styles.infoValue}>{accountType}</ThemedText>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <ThemedText style={styles.infoLabel}>Status</ThemedText>
              <ThemedText style={styles.infoValue}>
                {account.is_active ? "Active" : "Inactive"}
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
              <ThemedText style={styles.emptyText}>
                No transactions yet
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((transaction, index) => (
                <View
                  key={transaction.id}
                  style={index > 0 && { marginTop: 8 }}
                >
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
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  errorText: {
    fontSize: 14,
  },
  header: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
    minHeight: 140,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  accountType: {
    fontSize: 18,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  accountNumber: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
  },
  balance: {
    fontSize: 32,
    fontWeight: "bold",
    lineHeight: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
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
    fontWeight: "600",
  },
  infoValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  copyIcon: {
    marginLeft: 8,
  },
  transactionsList: {
    marginTop: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    opacity: 0.6,
    fontSize: 14,
  },
});

import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import type { InternalAccount } from "@/lib/api";

interface AccountCardProps {
  account: InternalAccount;
}

export function AccountCard({ account }: AccountCardProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
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
    // Show only last 4 digits, pad with zeros if needed
    const lastFour = accountNumber.slice(-4).padStart(4, "0");
    return `****${lastFour}`;
  };

  const handlePress = () => {
    router.push({
      pathname: "/(tabs)/(home)/account-detail",
      params: { accountId: account.id.toString() },
    });
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <ThemedView
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.accountInfo}>
            <ThemedText style={styles.accountType}>
              {account.account_type.charAt(0).toUpperCase() +
                account.account_type.slice(1)}{" "}
              Account
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
          <View style={styles.balanceRow}>
            <ThemedText style={styles.balance}>
              {formatCurrency(account.balance)}
            </ThemedText>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={colors.icon}
              style={styles.chevron}
            />
          </View>
        </View>
        <ThemedText style={styles.accountNumber}>
          {getCensoredAccountNumber(account.account_number)}
        </ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  accountType: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  balance: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 4,
  },
  chevron: {
    opacity: 0.6,
  },
  accountNumber: {
    fontSize: 14,
    opacity: 0.6,
  },
});

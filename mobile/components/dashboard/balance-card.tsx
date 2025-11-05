import { StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";

interface BalanceCardProps {
  balance: number;
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor: theme === "dark" ? colors.success + "20" : "#f0fdf4",
          borderColor: theme === "dark" ? colors.success + "40" : "#d1fae5",
        },
      ]}
    >
      <ThemedText style={styles.label}>Total Balance</ThemedText>
      <ThemedText
        style={[styles.balance, { color: colors.success }]}
        numberOfLines={1}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.5}
      >
        {formatCurrency(balance)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    minHeight: 80,
  },
  label: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  balance: {
    fontSize: 28,
    fontWeight: "bold",
    lineHeight: 36,
  },
});

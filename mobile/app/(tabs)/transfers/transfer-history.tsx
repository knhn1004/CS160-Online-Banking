import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { useTransferHistoryInfinite } from "@/lib/queries";
import type { TransferHistoryItem } from "@/lib/schemas/transfer";

interface TransferHistoryItemComponentProps {
  transfer: TransferHistoryItem;
}

function TransferHistoryItemComponent({
  transfer,
}: TransferHistoryItemComponentProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return "Today";
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const getTransferTypeDisplay = (
    type: "internal_transfer" | "external_transfer" | "deposit",
  ) => {
    if (type === "internal_transfer") return "Internal Transfer";
    if (type === "external_transfer") return "External Transfer";
    if (type === "deposit") return "Check Deposit";
    return "Transfer";
  };

  const getAccountDisplay = () => {
    if (transfer.transaction_type === "internal_transfer") {
      if (transfer.direction === "outbound") {
        return `To: ****${transfer.destination_account_number?.slice(-4) || ""}`;
      } else {
        return `From: ****${transfer.source_account_number?.slice(-4) || ""}`;
      }
    } else if (transfer.transaction_type === "external_transfer") {
      if (transfer.direction === "outbound") {
        return transfer.external_nickname
          ? `To: ${transfer.external_nickname}`
          : `To: External Account`;
      } else {
        return `From: External Account`;
      }
    } else if (transfer.transaction_type === "deposit") {
      // Deposits are always inbound
      return `To: ****${transfer.destination_account_number?.slice(-4) || ""}`;
    }
    return "";
  };

  const isInbound = transfer.direction === "inbound";
  const amountColor = isInbound ? colors.success : colors.warning;
  const statusColor =
    transfer.status === "approved" ? colors.success : colors.destructive;

  return (
    <ThemedView
      style={[
        styles.transferItem,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.transferHeader}>
        <View style={styles.transferInfo}>
          <ThemedText style={styles.transferType}>
            {getTransferTypeDisplay(transfer.transaction_type)}
          </ThemedText>
          <ThemedText
            style={[
              styles.transferDate,
              {
                color: colors.mutedForeground,
              },
            ]}
          >
            {formatDate(transfer.created_at)}
          </ThemedText>
        </View>
        <ThemedText style={[styles.transferAmount, { color: amountColor }]}>
          {isInbound ? "+" : "-"}
          {formatCurrency(Math.abs(transfer.amount))}
        </ThemedText>
      </View>
      <View style={styles.transferDetails}>
        <ThemedText
          style={[
            styles.transferAccount,
            {
              color: colors.mutedForeground,
            },
          ]}
        >
          {getAccountDisplay()}
        </ThemedText>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusColor + "20",
              borderColor: statusColor,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.statusText,
              {
                color: statusColor,
              },
            ]}
          >
            {transfer.status === "approved" ? "Approved" : "Denied"}
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

export default function TransferHistoryScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const {
    data,
    isLoading,
    isRefetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useTransferHistoryInfinite({
    limit: 20,
  });

  const transfers: TransferHistoryItem[] =
    data?.pages.flatMap((page) => page.transfers) ?? [];

  const handleRefresh = () => {
    refetch();
  };

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Transfer History",
          headerShown: true,
          headerBackTitle: "",
          headerTintColor: colors.text,
        }}
      />

      {isLoading && transfers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading transfers...</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={48}
            color={colors.destructive}
          />
          <ThemedText
            style={[
              styles.errorText,
              {
                color: colors.destructive,
              },
            ]}
          >
            {error instanceof Error ? error.message : "Failed to load transfers"}
          </ThemedText>
          <TouchableOpacity
            style={[
              styles.retryButton,
              {
                backgroundColor: colors.accent,
              },
            ]}
            onPress={() => refetch()}
          >
            <ThemedText
              style={[
                styles.retryButtonText,
                {
                  color: colors.accentForeground,
                },
              ]}
            >
              Retry
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : transfers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol
            name="tray"
            size={64}
            color={colors.mutedForeground}
          />
          <ThemedText
            style={[
              styles.emptyText,
              {
                color: colors.mutedForeground,
              },
            ]}
          >
            No transfers yet
          </ThemedText>
          <ThemedText
            style={[
              styles.emptySubtext,
              {
                color: colors.mutedForeground,
              },
            ]}
          >
            Your transfer history will appear here
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
          }
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } =
              event.nativeEvent;
            const paddingToBottom = 20;
            if (
              layoutMeasurement.height + contentOffset.y >=
              contentSize.height - paddingToBottom
            ) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {transfers.map((transfer) => (
            <TransferHistoryItemComponent key={transfer.id} transfer={transfer} />
          ))}
          {isFetchingNextPage && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" />
            </View>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  retryButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 8,
    gap: 4,
  },
  transferItem: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
  },
  transferHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  transferInfo: {
    flex: 1,
  },
  transferType: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 0,
  },
  transferDate: {
    fontSize: 10,
  },
  transferAmount: {
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 12,
  },
  transferDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  transferAccount: {
    fontSize: 11,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: "center",
  },
});



import { Stack, useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";
import { useFocusEffect } from "@react-navigation/native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { useAccounts } from "@/lib/queries";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";

interface BillPayRule {
  id: number;
  user_id: number;
  source_internal_id: number;
  payee_id: number;
  amount: number;
  frequency: string;
  start_time: string;
  end_time: string | null;
}

interface BillPayPayee {
  id: number;
  business_name: string;
  email: string;
  phone: string;
  street_address: string;
  address_line_2: string | null;
  city: string;
  state_or_territory: string;
  postal_code: string;
  country: string;
  account_number: string;
  routing_number: string;
  is_active: boolean;
}

const FREQUENCY_PRESETS = [
  { label: "Daily", value: "0 9 * * *" },
  { label: "Weekly (Monday)", value: "0 9 * * 1" },
  { label: "Bi-weekly (Monday)", value: "0 9 */2 * *" },
  { label: "Monthly (1st)", value: "0 9 1 * *" },
];

function getFrequencyLabel(frequency: string): string {
  const preset = FREQUENCY_PRESETS.find((p) => p.value === frequency);
  return preset ? preset.label : frequency;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100); // Convert from cents to dollars
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BillPayRulesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { data: accountsData } = useAccounts();
  const [rules, setRules] = useState<BillPayRule[]>([]);
  const [payees, setPayees] = useState<BillPayPayee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);

  const accounts = accountsData?.accounts || [];

  const fetchRules = useCallback(async () => {
    try {
      setError(null);
      const [rulesResult, payeesResult] = await Promise.all([
        api.getBillPayRules(),
        api.getBillPayees(),
      ]);
      setRules(rulesResult.rules);
      setPayees(payeesResult.payees);
    } catch (err) {
      console.error("Failed to fetch rules:", err);
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRules();
    }, [fetchRules]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRules();
  };

  const handleEditRule = (ruleId: number) => {
    router.push({
      pathname: "/(tabs)/transfers/billpay-transfer",
      params: { ruleId: ruleId.toString() },
    });
  };

  const handleDeleteRule = async (ruleId: number) => {
    Alert.alert(
      "Delete Rule",
      "Are you sure you want to delete this bill pay rule?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteBillPayRule(ruleId);
              Toast.show({
                type: "success",
                text1: "Success",
                text2: "Bill pay rule deleted successfully",
              });
              fetchRules();
            } catch (err) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2:
                  err instanceof Error
                    ? err.message
                    : "Failed to delete bill pay rule",
              });
            }
          },
        },
      ],
    );
  };

  const renderItem = (data: { item: BillPayRule; index: number }) => {
    const rule = data.item;
    const payee = payees.find((p) => p.id === rule.payee_id);
    const sourceAccount = accounts.find(
      (a) => a.id === rule.source_internal_id,
    );
    const rowKey = rule.id.toString();
    const isOpen = openRowKey === rowKey;

    return (
      <TouchableOpacity
        style={[
          styles.rowFront,
          styles.ruleCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderTopRightRadius: isOpen ? 0 : 16,
            borderBottomRightRadius: isOpen ? 0 : 16,
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
          },
        ]}
        onPress={() => handleEditRule(rule.id)}
        activeOpacity={0.7}
      >
        <View style={styles.ruleHeader}>
          <View style={styles.ruleHeaderLeft}>
            <ThemedText
              style={[
                styles.ruleAmount,
                {
                  color: colors.text,
                },
              ]}
            >
              {formatCurrency(rule.amount)}
            </ThemedText>
            <View
              style={[
                styles.frequencyBadge,
                {
                  backgroundColor: colors.accent + "20",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.frequencyBadgeText,
                  {
                    color: colors.accent,
                  },
                ]}
              >
                {getFrequencyLabel(rule.frequency)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.ruleDetails}>
          <ThemedText
            style={[
              styles.ruleDetailText,
              {
                color: colors.text,
                fontWeight: "500",
              },
            ]}
          >
            {payee?.business_name || "Unknown Payee"}
          </ThemedText>
          <ThemedText
            style={[
              styles.ruleDetailText,
              {
                color: colors.mutedForeground,
                fontSize: 13,
              },
            ]}
          >
            {sourceAccount
              ? `****${sourceAccount.account_number.slice(-4)}`
              : "Unknown"}{" "}
            • Starts {formatDate(rule.start_time)}
            {rule.end_time && ` • Ends ${formatDate(rule.end_time)}`}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  const closeRow = (rowMap: Record<string, any>, rowKey: string) => {
    if (rowMap[rowKey]) {
      rowMap[rowKey].closeRow();
    }
    setOpenRowKey(null);
  };

  const renderHiddenItem = (
    data: { item: BillPayRule; index: number },
    rowMap: Record<string, any>,
  ) => {
    const rule = data.item;
    const rowKey = rule.id.toString();

    return (
      <View style={styles.rowBack}>
        <TouchableOpacity
          style={[
            styles.backRightBtn,
            styles.backRightBtnLeft,
            {
              backgroundColor: colors.accent,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            },
          ]}
          onPress={() => {
            closeRow(rowMap, rowKey);
            handleEditRule(rule.id);
          }}
        >
          <IconSymbol
            name="pencil"
            size={20}
            color={colors.accentForeground}
          />
          <ThemedText
            style={[
              styles.backTextWhite,
              {
                color: colors.accentForeground,
              },
            ]}
          >
            Edit
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.backRightBtn,
            styles.backRightBtnRight,
            {
              backgroundColor: colors.destructive,
            },
          ]}
          onPress={() => {
            closeRow(rowMap, rowKey);
            handleDeleteRule(rule.id);
          }}
        >
          <IconSymbol name="trash" size={20} color={colors.background} />
          <ThemedText
            style={[
              styles.backTextWhite,
              {
                color: colors.background,
              },
            ]}
          >
            Delete
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen
          options={{
            title: "Bill Pay Rules",
            headerShown: true,
            headerBackTitle: "",
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading rules...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Bill Pay Rules",
          headerShown: true,
          headerBackTitle: "",
        }}
      />

      {error ? (
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
            {error}
          </ThemedText>
          <TouchableOpacity
            style={[
              styles.retryButton,
              {
                backgroundColor: colors.accent,
              },
            ]}
            onPress={fetchRules}
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
      ) : rules.length === 0 ? (
        <ScrollView
          style={styles.emptyScrollView}
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <IconSymbol
            name="doc.text"
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
            No bill pay rules yet
          </ThemedText>
          <ThemedText
            style={[
              styles.emptySubtext,
              {
                color: colors.mutedForeground,
              },
            ]}
          >
            Create a rule to automate your bill payments
          </ThemedText>
          <TouchableOpacity
            style={[
              styles.createButton,
              {
                backgroundColor: colors.accent,
              },
            ]}
            onPress={() => router.push("/(tabs)/transfers/billpay-transfer")}
          >
            <ThemedText
              style={[
                styles.createButtonText,
                {
                  color: colors.accentForeground,
                },
              ]}
            >
              Create Rule
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <SwipeListView
          data={rules}
          renderItem={renderItem}
          renderHiddenItem={renderHiddenItem}
          rightOpenValue={-160}
          stopRightSwipe={-160}
          disableRightSwipe={false}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          friction={8}
          tension={50}
          recalculateHiddenLayout={true}
          onRowOpen={(rowKey) => {
            setOpenRowKey(rowKey);
          }}
          onRowClose={() => {
            setOpenRowKey(null);
          }}
        />
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  rowFront: {
    backgroundColor: "transparent",
    borderRadius: 16,
    marginBottom: 0,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: "100%",
  },
  emptyScrollView: {
    flex: 1,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  createButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  ruleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    backgroundColor: "transparent",
    marginBottom: 0,
    minHeight: 100,
    justifyContent: "center",
  },
  ruleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  ruleHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  ruleAmount: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  frequencyBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  frequencyBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  ruleDetails: {
    gap: 6,
  },
  ruleDetailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "flex-end",
    borderRadius: 16,
    overflow: "hidden",
  },
  swipeActionButton: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 6,
  },
  editAction: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  deleteAction: {
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  swipeActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  rowBack: {
    alignItems: "center",
    backgroundColor: "transparent",
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 0,
    minHeight: 100,
  },
  backRightBtn: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    top: 0,
    width: 80,
    paddingVertical: 16,
    gap: 6,
  },
  backRightBtnLeft: {
    right: 80,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  backRightBtnRight: {
    right: 0,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  backTextWhite: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
});

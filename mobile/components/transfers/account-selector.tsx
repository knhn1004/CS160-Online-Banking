import React, { useCallback, useMemo, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import type { InternalAccount } from "@/lib/types";

interface AccountSelectorProps {
  accounts: InternalAccount[];
  selectedAccountId: number | null;
  onSelect: (accountId: number) => void;
  label?: string;
  excludeAccountId?: number;
  error?: string;
  disabled?: boolean;
}

export function AccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
  label = "Select Account",
  excludeAccountId,
  error,
  disabled = false,
}: AccountSelectorProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

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
    return `****${accountNumber.slice(-4)}`;
  };

  const filteredAccounts = useMemo(
    () =>
      excludeAccountId
        ? accounts.filter((acc) => acc.id !== excludeAccountId && acc.is_active)
        : accounts.filter((acc) => acc.is_active),
    [accounts, excludeAccountId],
  );

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);

  const snapPoints = useMemo(() => {
    // Calculate height based on number of accounts
    // Header: ~60px, Each item: ~70px, Bottom padding: ~40px (extra for safe area)
    const itemHeight = 70;
    const headerHeight = 60;
    const bottomPadding = 40;
    const screenHeight = Dimensions.get("window").height;
    const minHeight = 300; // Increased minimum to ensure it's tall enough
    const maxHeight = Math.min(screenHeight * 0.8, 700); // Up to 80% of screen
    
    // Calculate height needed to show all accounts
    const contentHeight = headerHeight + (filteredAccounts.length * itemHeight) + bottomPadding;
    
    // Use the larger of: content height or minimum, but cap at max
    const calculatedHeight = Math.min(
      Math.max(contentHeight, minHeight),
      maxHeight
    );
    
    // Always provide two snap points: calculated height and max height
    // This allows users to drag up if needed
    return [calculatedHeight, maxHeight];
  }, [filteredAccounts.length]);

  const handlePresentModalPress = useCallback(() => {
    if (!disabled) {
      bottomSheetModalRef.current?.present();
    }
  }, [disabled]);

  const handleSelectAccount = useCallback(
    (accountId: number) => {
      onSelect(accountId);
      bottomSheetModalRef.current?.dismiss();
    },
    [onSelect],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const renderAccountItem = useCallback(
    ({ item }: { item: InternalAccount }) => {
      const isSelected = item.id === selectedAccountId;
      const type =
        item.account_type.charAt(0).toUpperCase() + item.account_type.slice(1);
      const number = getCensoredAccountNumber(item.account_number);
      const balance = formatCurrency(item.balance);

      return (
        <TouchableOpacity
          style={[
            styles.accountItem,
            {
              backgroundColor: isSelected
                ? colors.accent + "20"
                : colors.card,
              borderBottomColor: colors.border,
            },
          ]}
          onPress={() => handleSelectAccount(item.id)}
        >
          <View style={styles.accountItemContent}>
            <View style={styles.accountItemInfo}>
              <ThemedText
                style={[
                  styles.accountItemType,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {type}
              </ThemedText>
              <ThemedText
                style={[
                  styles.accountItemNumber,
                  {
                    color: colors.mutedForeground,
                  },
                ]}
              >
                {number}
              </ThemedText>
            </View>
            <ThemedText
              style={[
                styles.accountItemBalance,
                {
                  color: colors.text,
                },
              ]}
            >
              {balance}
            </ThemedText>
          </View>
          {isSelected && (
            <IconSymbol
              name="checkmark.circle.fill"
              size={24}
              color={colors.accent}
            />
          )}
        </TouchableOpacity>
      );
    },
    [selectedAccountId, colors, handleSelectAccount],
  );

  return (
    <View style={styles.container}>
      {label && (
        <ThemedText style={styles.label}>{label}</ThemedText>
      )}
      <TouchableOpacity
        disabled={disabled}
        activeOpacity={0.7}
        style={[
          styles.selector,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
          },
          disabled && styles.disabled,
        ]}
        onPress={handlePresentModalPress}
      >
        {selectedAccount ? (
          <View style={styles.selectedAccount}>
            <View style={styles.accountInfo}>
              <ThemedText style={styles.accountType}>
                {selectedAccount.account_type.charAt(0).toUpperCase() +
                  selectedAccount.account_type.slice(1)}
              </ThemedText>
              <ThemedText style={styles.accountNumber}>
                {getCensoredAccountNumber(selectedAccount.account_number)}
              </ThemedText>
            </View>
            <ThemedText style={styles.balance}>
              {formatCurrency(selectedAccount.balance)}
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            style={[
              styles.placeholder,
              {
                color: colors.mutedForeground,
              },
            ]}
          >
            {label}
          </ThemedText>
        )}
        <IconSymbol
          name="chevron.down"
          size={20}
          color={colors.icon}
          style={styles.chevron}
        />
      </TouchableOpacity>
      {error && (
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
      )}

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        enableContentPanningGesture={true}
        enableHandlePanningGesture={true}
        backgroundStyle={{
          backgroundColor: colors.card,
        }}
        handleIndicatorStyle={{
          backgroundColor: colors.border,
          width: 40,
        }}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.accountList}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.bottomSheetHeader}>
            <ThemedText
              style={[
                styles.bottomSheetTitle,
                {
                  color: colors.text,
                },
              ]}
            >
              {label}
            </ThemedText>
          </View>
          {filteredAccounts.map((account) => (
            <View key={account.id}>
              {renderAccountItem({ item: account })}
            </View>
          ))}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  selectedAccount: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountType: {
    fontSize: 16,
    fontWeight: "500",
  },
  accountNumber: {
    fontSize: 14,
    opacity: 0.6,
  },
  balance: {
    fontSize: 16,
    fontWeight: "600",
  },
  placeholder: {
    fontSize: 16,
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  bottomSheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  accountList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 8,
    marginBottom: 4,
  },
  accountItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountItemInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountItemType: {
    fontSize: 16,
    fontWeight: "500",
  },
  accountItemNumber: {
    fontSize: 14,
  },
  accountItemBalance: {
    fontSize: 16,
    fontWeight: "600",
  },
});

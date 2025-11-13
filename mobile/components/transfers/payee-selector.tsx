import React, { useCallback, useMemo, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { router } from "expo-router";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";

interface Payee {
  id: number;
  business_name: string;
  email?: string;
  phone?: string;
}

interface PayeeSelectorProps {
  payees: Payee[];
  selectedPayeeId: number | undefined;
  onSelect: (payeeId: number | undefined) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  onRefreshPayees?: () => void;
}

export function PayeeSelector({
  payees,
  selectedPayeeId,
  onSelect,
  label = "Select Payee",
  error,
  disabled = false,
  onRefreshPayees: _onRefreshPayees,
}: PayeeSelectorProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const selectedPayee = payees.find((p) => p.id === selectedPayeeId);

  const snapPoints = useMemo(() => {
    // Calculate height based on number of payees
    // Header: ~60px, Each item: ~70px, Empty state: ~200px, Add button: ~70px, Bottom padding: ~40px (extra for safe area)
    const itemHeight = 70;
    const headerHeight = 60;
    const emptyStateHeight = 200; // Icon + text + padding
    const addButtonHeight = 70;
    const bottomPadding = 40;
    const screenHeight = Dimensions.get("window").height;
    const minHeight = 400; // Increased minimum height
    const maxHeight = Math.min(screenHeight * 0.85, 800); // Increased max height
    
    // Calculate height needed based on content
    let contentHeight: number;
    if (payees.length === 0) {
      // Empty state + add button
      contentHeight = headerHeight + emptyStateHeight + addButtonHeight + bottomPadding;
    } else {
      // Payees list + add button
      contentHeight = headerHeight + (payees.length * itemHeight) + addButtonHeight + bottomPadding;
    }
    
    const calculatedHeight = Math.min(
      Math.max(contentHeight, minHeight),
      maxHeight
    );
    
    return [calculatedHeight, maxHeight];
  }, [payees.length]);

  const handlePresentModalPress = useCallback(() => {
    if (!disabled) {
      bottomSheetModalRef.current?.present();
    }
  }, [disabled]);

  const handleSelectPayee = useCallback(
    (payeeId: number | undefined) => {
      onSelect(payeeId);
      bottomSheetModalRef.current?.dismiss();
    },
    [onSelect],
  );

  const handleAddNewPayee = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    router.push("/(tabs)/transfers/create-payee");
  }, []);

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

  const renderPayeeItem = useCallback(
    (payee: Payee) => {
      const isSelected = payee.id === selectedPayeeId;

      return (
        <TouchableOpacity
          key={payee.id}
          style={[
            styles.payeeItem,
            {
              backgroundColor: isSelected
                ? colors.accent + "20"
                : colors.card,
              borderBottomColor: colors.border,
            },
          ]}
          onPress={() => handleSelectPayee(payee.id)}
        >
          <View style={styles.payeeItemContent}>
            <View style={styles.payeeItemInfo}>
              <ThemedText
                style={[
                  styles.payeeItemName,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {payee.business_name}
              </ThemedText>
              {(payee.email || payee.phone) && (
                <ThemedText
                  style={[
                    styles.payeeItemDetail,
                    {
                      color: colors.mutedForeground,
                    },
                  ]}
                >
                  {payee.email || payee.phone}
                </ThemedText>
              )}
            </View>
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
    [selectedPayeeId, colors, handleSelectPayee],
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
        {selectedPayee ? (
          <View style={styles.selectedPayee}>
            <View style={styles.payeeInfo}>
              <ThemedText style={styles.payeeName}>
                {selectedPayee.business_name}
              </ThemedText>
              {(selectedPayee.email || selectedPayee.phone) && (
                <ThemedText style={styles.payeeDetail}>
                  {selectedPayee.email || selectedPayee.phone}
                </ThemedText>
              )}
            </View>
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
          contentContainerStyle={styles.payeeList}
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
          {payees.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                name="tray"
                size={48}
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
                No payees found
              </ThemedText>
              <ThemedText
                style={[
                  styles.emptySubtext,
                  {
                    color: colors.mutedForeground,
                  },
                ]}
              >
                Create a new payee to get started
              </ThemedText>
            </View>
          ) : (
            payees.map((payee) => renderPayeeItem(payee))
          )}
          <TouchableOpacity
            style={[
              styles.addPayeeButton,
              {
                backgroundColor: colors.accent,
              },
            ]}
            onPress={handleAddNewPayee}
          >
            <IconSymbol
              name="plus.circle.fill"
              size={20}
              color={colors.accentForeground}
            />
            <ThemedText
              style={[
                styles.addPayeeButtonText,
                {
                  color: colors.accentForeground,
                },
              ]}
            >
              Add New Payee
            </ThemedText>
          </TouchableOpacity>
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
  selectedPayee: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payeeInfo: {
    flex: 1,
  },
  payeeName: {
    fontSize: 16,
    fontWeight: "500",
  },
  payeeDetail: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
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
  payeeList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  payeeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 8,
    marginBottom: 4,
  },
  payeeItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  payeeItemInfo: {
    flex: 1,
  },
  payeeItemName: {
    fontSize: 16,
    fontWeight: "500",
  },
  payeeItemDetail: {
    fontSize: 14,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  addPayeeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 8,
    gap: 8,
  },
  addPayeeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});


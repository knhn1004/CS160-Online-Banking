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

interface FrequencyOption {
  label: string;
  value: string;
}

interface FrequencySelectorProps {
  options: FrequencyOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export function FrequencySelector({
  options,
  selectedValue,
  onSelect,
  label = "Select Frequency",
  error,
  disabled = false,
}: FrequencySelectorProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const selectedOption = options.find((opt) => opt.value === selectedValue);

  const snapPoints = useMemo(() => {
    // Calculate height based on number of options
    // Header: ~60px, Each item: ~70px, Bottom padding: ~40px (extra for safe area)
    const itemHeight = 70;
    const headerHeight = 60;
    const bottomPadding = 40;
    const screenHeight = Dimensions.get("window").height;
    const minHeight = 300;
    const maxHeight = Math.min(screenHeight * 0.8, 700);
    
    // Calculate height needed to show all options
    const contentHeight = headerHeight + (options.length * itemHeight) + bottomPadding;
    
    const calculatedHeight = Math.min(
      Math.max(contentHeight, minHeight),
      maxHeight
    );
    
    return [calculatedHeight, maxHeight];
  }, [options.length]);

  const handlePresentModalPress = useCallback(() => {
    if (!disabled) {
      bottomSheetModalRef.current?.present();
    }
  }, [disabled]);

  const handleSelectOption = useCallback(
    (value: string) => {
      onSelect(value);
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

  const renderOptionItem = useCallback(
    (option: FrequencyOption) => {
      const isSelected = option.value === selectedValue;

      return (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.optionItem,
            {
              backgroundColor: isSelected
                ? colors.accent + "20"
                : colors.card,
              borderBottomColor: colors.border,
            },
          ]}
          onPress={() => handleSelectOption(option.value)}
        >
          <View style={styles.optionItemContent}>
            <ThemedText
              style={[
                styles.optionItemLabel,
                {
                  color: colors.text,
                },
              ]}
            >
              {option.label}
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
    [selectedValue, colors, handleSelectOption],
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
        {selectedOption ? (
          <View style={styles.selectedOption}>
            <ThemedText style={styles.optionLabel}>
              {selectedOption.label}
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
          contentContainerStyle={styles.optionList}
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
          {options.map((option) => renderOptionItem(option))}
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
  selectedOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
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
  optionList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionItemLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
});



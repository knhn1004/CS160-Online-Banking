import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";

interface TransferOption {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  route: string;
}

export default function TransfersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const transferOptions: TransferOption[] = [
    {
      id: "internal",
      label: "Internal Transfer",
      icon: "arrow.left.arrow.right",
      description: "Transfer between your accounts",
      color: colors.accent,
      route: "/(tabs)/transfers/internal-transfer",
    },
    {
      id: "external",
      label: "External Transfer",
      icon: "paperplane.fill",
      description: "Send money to others",
      color: colors.success,
      route: "/(tabs)/transfers/external-transfer",
    },
    {
      id: "billpay",
      label: "Bill Pay",
      icon: "doc.text.fill",
      description: "Pay bills automatically",
      color: colors.warning,
      route: "/(tabs)/transfers/billpay-transfer",
    },
    {
      id: "billpay-rules",
      label: "Bill Pay Rules",
      icon: "list.bullet",
      description: "View and manage your rules",
      color: colors.warning,
      route: "/(tabs)/transfers/billpay-rules",
    },
    {
      id: "check",
      label: "Check Deposit",
      icon: "camera.fill",
      description: "Deposit a check",
      color: colors.accent,
      route: "/(tabs)/transfers/check-deposit",
    },
    {
      id: "history",
      label: "Transfer History",
      icon: "clock.fill",
      description: "View past transactions",
      color: colors.mutedForeground,
      route: "/(tabs)/transfers/transfer-history",
    },
  ];

  return (
    <ThemedView
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextContainer}>
            <ThemedText type="title" style={styles.title}>
              Transfers
            </ThemedText>
            <ThemedText
              style={[
                styles.subtitle,
                {
                  color: colors.mutedForeground,
                },
              ]}
            >
              Choose a transfer option
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[
              styles.apiKeyButton,
              {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => router.push("/(tabs)/transfers/api-keys")}
            activeOpacity={0.7}
          >
            <IconSymbol
              name="key.fill"
              size={20}
              color={colors.primaryForeground}
            />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.optionsContainer}
        showsVerticalScrollIndicator={false}
      >
        {transferOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.optionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push(option.route as any)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: option.color + "20",
                },
              ]}
            >
              <IconSymbol
                name={option.icon as any}
                size={28}
                color={option.color}
              />
            </View>
            <View style={styles.optionContent}>
              <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
              <ThemedText
                style={[
                  styles.optionDescription,
                  {
                    color: colors.mutedForeground,
                  },
                ]}
              >
                {option.description}
              </ThemedText>
            </View>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  apiKeyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionDescription: {
    fontSize: 14,
  },
});

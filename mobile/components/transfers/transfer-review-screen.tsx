import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";

interface TransferReviewScreenProps {
  title: string;
  details: {
    label: string;
    value: string;
    isAmount?: boolean;
  }[];
  onConfirm: () => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
}

export function TransferReviewScreen({
  title,
  details,
  onConfirm,
  onBack,
  isLoading = false,
  error,
}: TransferReviewScreenProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <IconSymbol
            name="doc.text.magnifyingglass"
            size={32}
            color={colors.accent}
          />
          <ThemedText type="title" style={styles.title}>
            {title}
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.detailsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {details.map((detail, index) => (
            <View
              key={index}
              style={[
                styles.detailRow,
                index < details.length - 1 && styles.detailRowBorder,
                {
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.detailLabel,
                  {
                    color: colors.mutedForeground,
                  },
                ]}
              >
                {detail.label}
              </ThemedText>
              <ThemedText
                style={[
                  styles.detailValue,
                  detail.isAmount && styles.amountValue,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {detail.value}
              </ThemedText>
            </View>
          ))}
        </ThemedView>

        {error && (
          <ThemedView
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.destructive + "20",
                borderColor: colors.destructive,
              },
            ]}
          >
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={20}
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
          </ThemedView>
        )}
      </ScrollView>

      <View
        style={[
          styles.actions,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.actionButton}>
          <ThemedText
            style={[
              styles.actionButtonText,
              {
                color: colors.text,
              },
            ]}
            onPress={onBack}
          >
            Back
          </ThemedText>
        </View>
        <View
          style={[
            styles.actionButton,
            styles.primaryAction,
            {
              backgroundColor: colors.accent,
              opacity: isLoading ? 0.6 : 1,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.actionButtonText,
              styles.primaryActionText,
              {
                color: colors.accentForeground,
              },
            ]}
            onPress={isLoading ? undefined : onConfirm}
          >
            {isLoading ? "Processing..." : "Confirm"}
          </ThemedText>
        </View>
      </View>
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
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    marginTop: 12,
    textAlign: "center",
  },
  detailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  amountValue: {
    fontSize: 20,
    fontWeight: "600",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryAction: {
    paddingVertical: 14,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryActionText: {
    color: "#ffffff",
  },
});


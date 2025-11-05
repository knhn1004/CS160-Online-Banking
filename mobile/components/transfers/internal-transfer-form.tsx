import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useForm } from "@tanstack/react-form";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { useAccounts, queryKeys } from "@/lib/queries";
import { api } from "@/lib/api";
import { InternalTransferSchema } from "@/lib/schemas/transfer";
import { CurrencyInput } from "./currency-input";
import { AccountSelector } from "./account-selector";
import { TransferReviewScreen } from "./transfer-review-screen";

type FormState =
  | "idle"
  | "filling"
  | "reviewing"
  | "submitting"
  | "success"
  | "error";

interface InternalTransferFormData {
  source_account_id: number | null;
  destination_account_id: number | null;
  amount: string;
}

export function InternalTransferForm() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    transaction_id: number;
    amount: number;
    source_account: string;
    destination_account: string;
  } | null>(null);

  const accounts = accountsData?.accounts || [];

  const form = useForm({
    defaultValues: {
      source_account_id: null,
      destination_account_id: null,
      amount: "",
    } as InternalTransferFormData,
    onSubmit: async ({ value }) => {
      setFormState("submitting");
      setError(null);

      try {
        const result = await api.transferInternal({
          source_account_id: value.source_account_id!,
          destination_account_id: value.destination_account_id!,
          amount: value.amount,
        });

        const sourceAccount = accounts.find(
          (acc) => acc.id === value.source_account_id,
        );
        const destinationAccount = accounts.find(
          (acc) => acc.id === value.destination_account_id,
        );

        setSuccessData({
          transaction_id: result.transaction_id,
          amount: result.amount,
          source_account: sourceAccount?.account_number || "",
          destination_account: destinationAccount?.account_number || "",
        });

        // Invalidate queries to refresh balances and transfer history
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
        queryClient.invalidateQueries({ queryKey: ["transferHistory"] });

        setFormState("success");
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Transfer completed successfully",
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Transfer failed";
        setError(errorMessage);
        setFormState("error");
        Toast.show({
          type: "error",
          text1: "Error",
          text2: errorMessage,
        });
      }
    },
  });

  useEffect(() => {
    if (accounts.length > 0 && formState === "idle") {
      setFormState("filling");
    }
  }, [accounts.length, formState]);

  const handleContinue = () => {
    const sourceId = form.getFieldValue("source_account_id");
    const destId = form.getFieldValue("destination_account_id");
    const amount = form.getFieldValue("amount");

    if (!sourceId || !destId || !amount) {
      setError("Please fill in all fields");
      return;
    }

    const result = InternalTransferSchema.safeParse({
      source_account_id: sourceId,
      destination_account_id: destId,
      amount: amount,
    });

    if (result.success) {
      setFormState("reviewing");
      setError(null);
    } else {
      const firstError = result.error.issues[0];
      setError(firstError.message);
    }
  };

  const handleBack = () => {
    setFormState("filling");
    setError(null);
  };

  const handleReset = () => {
    form.reset();
    setFormState("filling");
    setError(null);
    setSuccessData(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getAccountDisplay = (accountId: number | null) => {
    if (!accountId) return "Unknown Account";
    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) return "Unknown Account";
    const type =
      account.account_type.charAt(0).toUpperCase() +
      account.account_type.slice(1);
    return `${type} ****${account.account_number.slice(-4)}`;
  };

  if (accountsLoading || accounts.length === 0) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading accounts...</ThemedText>
      </ThemedView>
    );
  }

  if (accounts.length < 2) {
    return (
      <ThemedView
        style={[
          styles.errorCard,
          {
            backgroundColor: colors.warning + "20",
            borderColor: colors.warning,
          },
        ]}
      >
        <IconSymbol
          name="exclamationmark.triangle.fill"
          size={24}
          color={colors.warning}
        />
        <ThemedText
          style={[
            styles.errorText,
            {
              color: colors.warning,
            },
          ]}
        >
          You need at least 2 active accounts to make internal transfers.
        </ThemedText>
      </ThemedView>
    );
  }

  if (formState === "success" && successData) {
    return (
      <>
        {/* Render the form in the background */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
        </ScrollView>

        {/* Full-screen success modal */}
        <Modal
          visible={formState === "success"}
          animationType="slide"
          transparent={false}
          onRequestClose={handleReset}
        >
          <ThemedView
            style={[
              styles.successModalContainer,
              {
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.successContent}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleReset}
              >
                <IconSymbol name="xmark" size={24} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.successContentInner}>
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={80}
                  color={colors.success}
                />
                <View style={styles.successTitleContainer}>
                  <ThemedText type="title" style={styles.successTitle}>
                    Transfer Successful!
                  </ThemedText>
                </View>
                <View style={styles.successAmountContainer}>
                  <ThemedText style={styles.successAmount}>
                    {formatCurrency(successData.amount / 100)}
                  </ThemedText>
                </View>
                <View style={styles.successDetails}>
                  <ThemedText
                    style={[
                      styles.successDetail,
                      {
                        color: colors.mutedForeground,
                      },
                    ]}
                  >
                    From: {getAccountDisplay(
                      accounts.find(
                        (acc) =>
                          acc.account_number === successData.source_account,
                      )?.id || null,
                    )}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.successDetail,
                      {
                        color: colors.mutedForeground,
                      },
                    ]}
                  >
                    To: {getAccountDisplay(
                      accounts.find(
                        (acc) =>
                          acc.account_number === successData.destination_account,
                      )?.id || null,
                    )}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.successDetail,
                      {
                        color: colors.mutedForeground,
                        fontSize: 12,
                      },
                    ]}
                  >
                    Transaction ID: {successData.transaction_id}
                  </ThemedText>
                </View>
                <View style={styles.successButtons}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.secondaryButton,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      handleReset();
                      router.push("/(tabs)/transfers/transfer-history");
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.buttonText,
                        {
                          color: colors.text,
                        },
                      ]}
                    >
                      View History
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor: colors.accent,
                      },
                    ]}
                    onPress={handleReset}
                  >
                    <ThemedText
                      style={[
                        styles.buttonText,
                        {
                          color: colors.accentForeground,
                        },
                      ]}
                    >
                      Make Another Transfer
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </ThemedView>
        </Modal>
      </>
    );
  }

  if (formState === "reviewing") {
    const sourceId = form.getFieldValue("source_account_id");
    const destId = form.getFieldValue("destination_account_id");
    const amount = form.getFieldValue("amount");
    const sourceAccount = accounts.find((acc) => acc.id === sourceId);

    const details = [
      {
        label: "From Account",
        value: getAccountDisplay(sourceId),
      },
      {
        label: "To Account",
        value: getAccountDisplay(destId),
      },
      {
        label: "Amount",
        value: formatCurrency(parseFloat(amount) || 0),
        isAmount: true,
      },
      ...(sourceAccount
        ? [
            {
              label: "Available Balance",
              value: formatCurrency(sourceAccount.balance),
            },
          ]
        : []),
    ];

    return (
      <TransferReviewScreen
        title="Review Transfer"
        details={details}
        onConfirm={() => form.handleSubmit()}
        onBack={handleBack}
        isLoading={false}
        error={error || undefined}
      />
    );
  }

  return (
    <form.Subscribe
      selector={(state) => [
        state.values.source_account_id,
        state.values.destination_account_id,
        state.values.amount,
      ]}
    >
      {(formValues) => {
        const sourceAccountId = formValues[0] as number | null;
        const destinationAccountId = formValues[1] as number | null;
        const amount = formValues[2] as string;
        const isFormValid =
          sourceAccountId &&
          destinationAccountId &&
          amount &&
          typeof amount === "string" &&
          amount.trim() !== "";

        return (
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <form.Field
              name="source_account_id"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Source account is required";
                  return undefined;
                },
              }}
            >
              {(field) => (
                <View style={styles.field}>
                  <AccountSelector
                    accounts={accounts}
                    selectedAccountId={field.state.value}
                    onSelect={field.handleChange}
                    label="From Account"
                    excludeAccountId={destinationAccountId || undefined}
                    error={
                      field.state.meta.errors.length > 0
                        ? field.state.meta.errors[0]
                        : undefined
                    }
                  />
                </View>
              )}
            </form.Field>

            <form.Field
              name="destination_account_id"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Destination account is required";
                  if (value === sourceAccountId) {
                    return "Destination account must be different from source account";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <View style={styles.field}>
                  <AccountSelector
                    accounts={accounts}
                    selectedAccountId={field.state.value}
                    onSelect={field.handleChange}
                    label="To Account"
                    excludeAccountId={sourceAccountId || undefined}
                    error={
                      field.state.meta.errors.length > 0
                        ? field.state.meta.errors[0]
                        : undefined
                    }
                  />
                </View>
              )}
            </form.Field>

            <form.Field
              name="amount"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.trim() === "") return "Amount is required";

                  const numValue = parseFloat(value);
                  if (isNaN(numValue) || numValue <= 0)
                    return "Amount must be greater than $0.00";
                  if (numValue < 0.01) return "Amount must be at least $0.01";
                  if (numValue > 9999999.99)
                    return "Amount cannot exceed $9,999,999.99";

                  if (sourceAccountId) {
                    const sourceAccount = accounts.find(
                      (acc) => acc.id === sourceAccountId,
                    );
                    if (sourceAccount && numValue > sourceAccount.balance) {
                      return "Insufficient funds";
                    }
                  }

                  return undefined;
                },
              }}
            >
              {(field) => (
                <View style={styles.field}>
                  <ThemedText style={styles.label}>Amount</ThemedText>
                  <CurrencyInput
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="0.00"
                    error={
                      field.state.meta.errors.length > 0
                        ? field.state.meta.errors[0]
                        : undefined
                    }
                  />
                </View>
              )}
            </form.Field>

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

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: colors.accent,
                  opacity: formState === "submitting" || !isFormValid ? 0.6 : 1,
                },
              ]}
              onPress={handleContinue}
              disabled={formState === "submitting" || !isFormValid}
            >
              {formState === "submitting" ? (
                <ActivityIndicator color={colors.accentForeground} />
              ) : (
                <ThemedText
                  style={[
                    styles.buttonText,
                    {
                      color: colors.accentForeground,
                    },
                  ]}
                >
                  Continue
                </ThemedText>
              )}
            </TouchableOpacity>
          </ScrollView>
        );
      }}
    </form.Subscribe>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  successModalContainer: {
    flex: 1,
  },
  successContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  successContentInner: {
    alignItems: "center",
    width: "100%",
    flex: 1,
    justifyContent: "center",
  },
  successTitleContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 0,
    paddingBottom: 0,
    minHeight: 60,
  },
  successAmountContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 32,
    marginBottom: 24,
    paddingTop: 0,
    minHeight: 50,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: 8,
    marginBottom: 16,
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
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 48,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  successTitle: {
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: 42,
  },
  successAmount: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: 48,
  },
  successDetails: {
    width: "100%",
    marginBottom: 24,
    gap: 8,
  },
  successDetail: {
    fontSize: 14,
    textAlign: "center",
  },
  successButtons: {
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    borderWidth: 1,
  },
});


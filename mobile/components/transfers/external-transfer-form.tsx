import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
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
import { ExternalTransferSchema } from "@/lib/schemas/transfer";
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

interface ExternalTransferFormData {
  source_account_id: number | null;
  recipient_email: string;
  recipient_phone: string;
  destination_account_id?: number;
  amount: string;
}

interface LookupResult {
  found: boolean;
  user?: {
    id: number;
    email: string;
    phone_number: string;
    first_name: string;
    last_name: string;
      accounts: {
        id: number;
        account_type: string;
      }[];
  };
}

export function ExternalTransferForm() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    transaction_id: number;
    amount: number;
    recipient_name: string;
  } | null>(null);

  const accounts = accountsData?.accounts || [];

  const form = useForm({
    defaultValues: {
      source_account_id: null,
      recipient_email: "",
      recipient_phone: "",
      destination_account_id: undefined,
      amount: "",
    } as ExternalTransferFormData,
    onSubmit: async ({ value }) => {
      setFormState("submitting");
      setError(null);

      try {
        const result = await api.transferExternal({
          source_account_id: value.source_account_id!,
          amount: value.amount,
          recipient_email: value.recipient_email || undefined,
          recipient_phone: value.recipient_phone || undefined,
          destination_account_id: value.destination_account_id,
        });

        setSuccessData({
          transaction_id: result.transaction_id,
          amount: result.amount,
          recipient_name: result.recipient_name,
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

  const handleLookup = useCallback(async (email?: string, phone?: string): Promise<LookupResult | null> => {
    const emailValue = email ?? form.getFieldValue("recipient_email");
    const phoneValue = phone ?? form.getFieldValue("recipient_phone");

    if (!emailValue && !phoneValue) {
      setLookupError("Please enter either email or phone number");
      setLookupResult(null);
      return null;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const result = await api.lookupRecipient({
        email: emailValue || undefined,
        phone: phoneValue || undefined,
      });

      setLookupResult(result);

      if (result.found && result.user && result.user.accounts.length === 1) {
        form.setFieldValue(
          "destination_account_id",
          result.user.accounts[0].id,
        );
      }

      return result;
    } catch (err) {
      const errorResult = { found: false } as LookupResult;
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
      setLookupResult(errorResult);
      return errorResult;
    } finally {
      setLookupLoading(false);
    }
  }, [form]);

  const handleContinue = async () => {
    const recipientEmail = form.getFieldValue("recipient_email");
    const recipientPhone = form.getFieldValue("recipient_phone");
    const destinationAccountId = form.getFieldValue("destination_account_id");

    // If email/phone is entered but lookup hasn't been done or failed, trigger lookup first
    const hasEmailOrPhone = recipientEmail.trim() || recipientPhone.trim();
    if (hasEmailOrPhone && (!lookupResult || lookupResult.found === false)) {
      const lookupResultValue = await handleLookup(recipientEmail.trim() || undefined, recipientPhone.trim() || undefined);
      // If lookup failed, don't proceed
      if (!lookupResultValue || lookupResultValue.found === false) {
        return;
      }
    }

    const formData = {
      source_account_id: form.getFieldValue("source_account_id"),
      amount: form.getFieldValue("amount"),
      ...(recipientEmail.trim() ? { recipient_email: recipientEmail.trim() } : {}),
      ...(recipientPhone.trim() ? { recipient_phone: recipientPhone.trim() } : {}),
      ...(destinationAccountId
        ? { destination_account_id: destinationAccountId }
        : {}),
    };

    const result = ExternalTransferSchema.safeParse(formData);

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
    setLookupResult(null);
    setLookupError(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getAccountDisplay = (accountId: number | undefined) => {
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
                    To: {successData.recipient_name}
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
    const amount = form.getFieldValue("amount");
    const recipientEmail = form.getFieldValue("recipient_email");
    const recipientPhone = form.getFieldValue("recipient_phone");
    const sourceAccount = accounts.find((acc) => acc.id === sourceId);

    const recipientName =
      lookupResult?.user
        ? `${lookupResult.user.first_name} ${lookupResult.user.last_name}`
        : recipientEmail || recipientPhone || "External Recipient";

    const details = [
      {
        label: "From Account",
        value: getAccountDisplay(sourceId || undefined),
      },
      {
        label: "To",
        value: recipientName,
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
              error={
                field.state.meta.errors.length > 0
                  ? field.state.meta.errors[0]
                  : undefined
              }
            />
          </View>
        )}
      </form.Field>

      <form.Field name="recipient_email">
        {(field) => (
          <View style={styles.field}>
            <ThemedText style={styles.label}>Recipient Email</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={() => {
                const email = field.state.value.trim();
                const phone = form.getFieldValue("recipient_phone").trim();
                if (email || phone) {
                  handleLookup(email || undefined, phone || undefined);
                }
              }}
              placeholder="email@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}
      </form.Field>

      <form.Field name="recipient_phone">
        {(field) => (
          <View style={styles.field}>
            <ThemedText style={styles.label}>Recipient Phone</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={() => {
                const phone = field.state.value.trim();
                const email = form.getFieldValue("recipient_email").trim();
                if (email || phone) {
                  handleLookup(email || undefined, phone || undefined);
                }
              }}
              placeholder="+1234567890"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
            />
            <ThemedText
              style={[
                styles.hint,
                {
                  color: colors.mutedForeground,
                },
              ]}
            >
              Enter either email or phone number
            </ThemedText>
          </View>
        )}
      </form.Field>

      {lookupLoading && (
        <View style={styles.lookupLoadingContainer}>
          <ActivityIndicator size="small" />
          <ThemedText
            style={[
              styles.lookupLoadingText,
              {
                color: colors.mutedForeground,
              },
            ]}
          >
            Looking up recipient...
          </ThemedText>
        </View>
      )}

      {lookupResult?.found && lookupResult.user && (
        <ThemedView
          style={[
            styles.lookupResult,
            {
              backgroundColor: colors.success + "20",
              borderColor: colors.success,
            },
          ]}
        >
          <IconSymbol
            name="checkmark.circle.fill"
            size={20}
            color={colors.success}
          />
          <View style={styles.lookupResultContent}>
            <ThemedText
              style={[
                styles.lookupResultName,
                {
                  color: colors.text,
                },
              ]}
            >
              {lookupResult.user.first_name} {lookupResult.user.last_name}
            </ThemedText>
            <ThemedText
              style={[
                styles.lookupResultDetail,
                {
                  color: colors.mutedForeground,
                },
              ]}
            >
              {lookupResult.user.email} • {lookupResult.user.phone_number}
            </ThemedText>
            {lookupResult.user.accounts.length > 0 && (
              <ThemedText
                style={[
                  styles.lookupResultDetail,
                  {
                    color: colors.mutedForeground,
                    fontSize: 12,
                    marginTop: 4,
                  },
                ]}
              >
                {lookupResult.user.accounts.length} account(s) available
              </ThemedText>
            )}
          </View>
        </ThemedView>
      )}

      {lookupResult?.found && lookupResult.user && lookupResult.user.accounts.length > 0 && (
        <form.Field name="destination_account_id">
          {(field) => (
            <View style={styles.field}>
              <AccountSelector
                accounts={accounts.filter((acc) =>
                  lookupResult.user!.accounts.some(
                    (userAcc) => userAcc.id === acc.id,
                  ),
                )}
                selectedAccountId={field.state.value ?? null}
                onSelect={(value) => field.handleChange(value)}
                label="Destination Account"
              />
            </View>
          )}
        </form.Field>
      )}

      {lookupError && (
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
            {lookupError}
          </ThemedText>
        </ThemedView>
      )}

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

            const sourceId = form.getFieldValue("source_account_id");
            if (sourceId) {
              const sourceAccount = accounts.find((acc) => acc.id === sourceId);
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

      <form.Subscribe
        selector={(state) => [
          state.values.source_account_id,
          state.values.recipient_email,
          state.values.recipient_phone,
          state.values.destination_account_id,
          state.values.amount,
        ]}
      >
        {(formValues) => {
          const sourceAccountId = formValues[0] as number | null;
          const recipientEmail = formValues[1] as string;
          const recipientPhone = formValues[2] as string;
          const destinationAccountId = formValues[3] as number | undefined;
          const amount = formValues[4] as string;

          // Check if email or phone is entered
          const hasEmailOrPhone = recipientEmail.trim() || recipientPhone.trim();
          
          // If email/phone is entered, lookup must be successful
          // If no email/phone, we can proceed (though this shouldn't happen in practice)
          const lookupRequired = hasEmailOrPhone;
          const lookupSuccessful = lookupResult?.found === true;
          
          // If user has multiple accounts, destination_account_id is required
          // If user has 1 account, it's auto-selected
          const needsDestinationAccount = 
            lookupResult?.found && 
            lookupResult.user && 
            lookupResult.user.accounts.length > 1 &&
            !destinationAccountId;

          const isFormValid =
            formState !== "submitting" &&
            sourceAccountId &&
            amount &&
            typeof amount === "string" &&
            amount.trim() !== "" &&
            (!lookupRequired || lookupSuccessful) &&
            !needsDestinationAccount &&
            !lookupLoading;

          return (
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: colors.accent,
                  opacity: isFormValid ? 1 : 0.6,
                },
              ]}
              onPress={handleContinue}
              disabled={!isFormValid}
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
          );
        }}
      </form.Subscribe>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
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
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  lookupLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  lookupLoadingText: {
    fontSize: 14,
    marginLeft: 8,
  },
  lookupResult: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  lookupResultContent: {
    flex: 1,
  },
  lookupResultName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  lookupResultDetail: {
    fontSize: 14,
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


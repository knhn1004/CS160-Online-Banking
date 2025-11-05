import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useForm } from "@tanstack/react-form";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { useAccounts } from "@/lib/queries";
import { api } from "@/lib/api";
import { CurrencyInput } from "./currency-input";
import { AccountSelector } from "./account-selector";
import { PayeeSelector } from "./payee-selector";
import { FrequencySelector } from "./frequency-selector";
import { TransferReviewScreen } from "./transfer-review-screen";

type FormState =
  | "idle"
  | "filling"
  | "reviewing"
  | "submitting"
  | "success"
  | "error";

const FREQUENCY_PRESETS = [
  { label: "Daily", value: "0 9 * * *" },
  { label: "Weekly (Monday)", value: "0 9 * * 1" },
  { label: "Bi-weekly (Monday)", value: "0 9 */2 * *" },
  { label: "Monthly (1st)", value: "0 9 1 * *" },
];

interface BillPayFormData {
  source_account_id: number | null;
  payee_id?: number;
  payee?: {
    business_name: string;
    email: string;
    phone: string;
    street_address: string;
    address_line_2?: string;
    city: string;
    state_or_territory: string;
    postal_code: string;
    country?: string;
    account_number: string;
    routing_number: string;
  };
  amount: string;
  frequency: string;
  start_time: string;
  end_time?: string;
}

interface BillPayFormProps {
  ruleId?: number;
}

export function BillPayForm({ ruleId }: BillPayFormProps = {}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [payees, setPayees] = useState<any[]>([]);
  const [frequencyPreset, setFrequencyPreset] = useState("0 9 * * *");
  const [isLoadingRule, setIsLoadingRule] = useState(false);
  const [successData, setSuccessData] = useState<{
    rule_id: number;
    amount: number;
    payee_name: string;
  } | null>(null);

  const accounts = accountsData?.accounts || [];
  const isEditMode = !!ruleId;

  const fetchPayees = useCallback(async () => {
    try {
      const result = await api.getBillPayees();
      setPayees(result.payees.filter((p) => p.is_active));
    } catch (err) {
      console.error("Failed to fetch payees:", err);
    }
  }, []);

  const form = useForm({
    defaultValues: {
      source_account_id: null,
      payee_id: undefined,
      payee: undefined,
      amount: "",
      frequency: "0 9 * * *",
      start_time: "", // Will be set on submit to ensure it's in the future
      end_time: "",
    } as BillPayFormData,
    onSubmit: async ({ value }) => {
      setFormState("submitting");
      setError(null);

      try {
        // Validate required fields before submission
        if (!value.source_account_id) {
          throw new Error("Source account is required");
        }
        if (!value.payee_id && !value.payee) {
          throw new Error("Payee is required");
        }
        if (!value.amount || value.amount.trim() === "") {
          throw new Error("Amount is required");
        }

        const frequency =
          frequencyPreset === "custom" ? value.frequency : frequencyPreset;

        if (!frequency || frequency.trim() === "") {
          throw new Error("Frequency is required");
        }

        let result;
        if (isEditMode && ruleId) {
          // Update existing rule
          const updateData: {
            source_account_id?: number;
            payee_id?: number;
            amount?: string;
            frequency?: string;
            start_time?: string;
            end_time?: string | null;
          } = {};

          // Only include fields that have changed
          if (value.source_account_id) {
            updateData.source_account_id = value.source_account_id;
          }
          if (value.payee_id) {
            updateData.payee_id = value.payee_id;
          }
          if (value.amount) {
            updateData.amount = value.amount;
          }
          if (frequency) {
            updateData.frequency = frequency;
          }
          if (value.start_time) {
            updateData.start_time = value.start_time;
          }
          if (value.end_time !== undefined) {
            updateData.end_time = value.end_time || null;
          }

          result = await api.updateBillPayRule(ruleId, updateData);
        } else {
          // Create new rule
          // Ensure start_time is in the future (at least 1 hour from now)
          const futureStartTime = new Date();
          futureStartTime.setHours(futureStartTime.getHours() + 1);
          const startTimeToUse = value.start_time || futureStartTime.toISOString();

          // Ensure amount is properly formatted (ensure it has decimal places)
          let formattedAmount = value.amount;
          if (formattedAmount && !formattedAmount.includes(".")) {
            formattedAmount = `${formattedAmount}.00`;
          } else if (formattedAmount && formattedAmount.includes(".")) {
            const parts = formattedAmount.split(".");
            if (parts[1].length === 1) {
              formattedAmount = `${parts[0]}.${parts[1]}0`;
            } else if (parts[1].length === 0) {
              formattedAmount = `${parts[0]}.00`;
            }
          }

          result = await api.createBillPayRule({
            source_account_id: value.source_account_id!,
            payee_id: value.payee_id,
            payee: value.payee,
            amount: formattedAmount,
            frequency,
            start_time: startTimeToUse,
            end_time: value.end_time && value.end_time.trim() !== "" ? value.end_time : undefined,
          });
        }

        const payeeName =
          payees.find((p) => p.id === result.rule.payee_id)?.business_name ||
          value.payee?.business_name ||
          "Unknown";

        setSuccessData({
          rule_id: result.rule.id,
          amount: result.rule.amount,
          payee_name: payeeName,
        });

        setFormState("success");
        Toast.show({
          type: "success",
          text1: "Success",
          text2: isEditMode
            ? "Bill pay rule updated successfully"
            : "Bill pay rule created successfully",
        });
      } catch (err) {
        let errorMessage = isEditMode
          ? "Failed to update bill pay rule"
          : "Failed to create bill pay rule";
        if (err instanceof Error) {
          errorMessage = err.message;
          // If the error includes validation details, use those
          if (errorMessage.includes("Invalid request body") || errorMessage.includes(":")) {
            // Already formatted with details
          } else {
            // Try to extract more details from the error if it's an API error
            console.error("Bill pay error:", err);
          }
        } else if (typeof err === "object" && err !== null && "message" in err) {
          errorMessage = String(err.message);
        }
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

  // Fetch rule data when in edit mode
  useEffect(() => {
    if (isEditMode && ruleId) {
      const fetchRule = async () => {
        setIsLoadingRule(true);
        try {
          const result = await api.getBillPayRules();
          const rule = result.rules.find((r) => r.id === ruleId);

          if (rule) {
            // Pre-populate form with existing rule data
            form.setFieldValue("source_account_id", rule.source_internal_id);
            form.setFieldValue("payee_id", rule.payee_id);
            form.setFieldValue(
              "amount",
              (rule.amount / 100).toFixed(2), // Convert from cents to dollars
            );
            form.setFieldValue("frequency", rule.frequency);
            form.setFieldValue("start_time", rule.start_time);
            form.setFieldValue("end_time", rule.end_time || "");

            // Set frequency preset if it matches
            const preset = FREQUENCY_PRESETS.find((p) => p.value === rule.frequency);
            if (preset) {
              setFrequencyPreset(preset.value);
            } else {
              setFrequencyPreset("custom");
            }

            setFormState("filling");
          }
        } catch (err) {
          console.error("Failed to fetch rule:", err);
          setError("Failed to load rule data");
        } finally {
          setIsLoadingRule(false);
        }
      };
      fetchRule();
    } else if (!isEditMode && accounts.length > 0 && formState === "idle") {
      setFormState("filling");
    }
  }, [isEditMode, ruleId, accounts.length, formState, form]);

  useEffect(() => {
    fetchPayees();
  }, [fetchPayees]);

  // Refresh payees when screen comes into focus (e.g., after creating a payee)
  useFocusEffect(
    useCallback(() => {
      fetchPayees();
      return () => {}; // Cleanup function
    }, [fetchPayees]),
  );

  const handleContinue = () => {
    const sourceId = form.getFieldValue("source_account_id");
    const payeeId = form.getFieldValue("payee_id");
    const payee = form.getFieldValue("payee");
    const amount = form.getFieldValue("amount");

    if (!sourceId || (!payeeId && !payee) || !amount) {
      setError("Please fill in all required fields");
      return;
    }

    setFormState("reviewing");
    setError(null);
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

  if (accountsLoading || isLoadingRule || accounts.length === 0) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>
          {isLoadingRule ? "Loading rule..." : "Loading accounts..."}
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
                    {isEditMode
                      ? "Bill Pay Rule Updated!"
                      : "Bill Pay Rule Created!"}
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
                    Payee: {successData.payee_name}
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
                    Rule ID: {successData.rule_id}
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
                      router.push("/(tabs)/transfers/billpay-rules");
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
                      View Rules
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
                      {isEditMode ? "Done" : "Create Another Rule"}
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
    const payeeId = form.getFieldValue("payee_id");
    const payee = form.getFieldValue("payee");
    const amount = form.getFieldValue("amount");
    const frequency = frequencyPreset === "custom" ? form.getFieldValue("frequency") : frequencyPreset;

    const payeeName =
      payees.find((p) => p.id === payeeId)?.business_name ||
      payee?.business_name ||
      "Unknown";

    const details = [
      {
        label: "From Account",
        value: accounts.find((acc) => acc.id === sourceId)?.account_number
          ? `****${accounts.find((acc) => acc.id === sourceId)!.account_number.slice(-4)}`
          : "Unknown",
      },
      {
        label: "Payee",
        value: payeeName,
      },
      {
        label: "Amount",
        value: formatCurrency(parseFloat(amount) || 0),
        isAmount: true,
      },
      {
        label: "Frequency",
        value: FREQUENCY_PRESETS.find((p) => p.value === frequency)?.label || frequency,
      },
    ];

    return (
      <TransferReviewScreen
        title={isEditMode ? "Review Bill Pay Rule Update" : "Review Bill Pay Rule"}
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

      <form.Field name="payee_id">
        {(field) => (
          <View style={styles.field}>
            <PayeeSelector
              payees={payees}
              selectedPayeeId={field.state.value}
              onSelect={(payeeId) => {
                field.handleChange(payeeId);
                if (payeeId) {
                  form.setFieldValue("payee", undefined);
                }
              }}
              label="Select Payee"
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

      <View style={styles.field}>
        <FrequencySelector
          options={FREQUENCY_PRESETS}
          selectedValue={frequencyPreset}
          onSelect={(value) => {
            setFrequencyPreset(value);
            form.setFieldValue("frequency", value);
          }}
          label="Frequency"
        />
      </View>

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
          state.values.payee_id,
          state.values.payee,
          state.values.amount,
        ]}
      >
        {(formValues) => {
          const sourceAccountId = formValues[0] as number | null;
          const payeeId = formValues[1] as number | undefined;
          const payee = formValues[2] as object | undefined;
          const amount = formValues[3] as string;

          const isFormValid =
            formState !== "submitting" &&
            sourceAccountId !== null &&
            (payeeId !== undefined || payee !== undefined) &&
            amount &&
            typeof amount === "string" &&
            amount.trim() !== "";

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
  button: {
    borderRadius: 8,
    paddingVertical: 14,
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
  successCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
});


import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useForm } from "@tanstack/react-form";
import { useFocusEffect } from "@react-navigation/native";
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

export function BillPayForm() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [payees, setPayees] = useState<any[]>([]);
  const [frequencyPreset, setFrequencyPreset] = useState("0 9 * * *");
  const [successData, setSuccessData] = useState<{
    rule_id: number;
    amount: number;
    payee_name: string;
  } | null>(null);

  const accounts = accountsData?.accounts || [];

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
      start_time: new Date().toISOString(),
      end_time: "",
    } as BillPayFormData,
    onSubmit: async ({ value }) => {
      setFormState("submitting");
      setError(null);

      try {
        const frequency =
          frequencyPreset === "custom" ? value.frequency : frequencyPreset;

        const result = await api.createBillPayRule({
          source_account_id: value.source_account_id!,
          payee_id: value.payee_id,
          payee: value.payee,
          amount: value.amount,
          frequency,
          start_time: value.start_time,
          end_time: value.end_time,
        });

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
          text2: "Bill pay rule created successfully",
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create bill pay rule";
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
    fetchPayees();
    if (accounts.length > 0 && formState === "idle") {
      setFormState("filling");
    }
  }, [accounts.length, formState, fetchPayees]);

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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <ThemedView
          style={[
            styles.successCard,
            {
              backgroundColor: colors.success + "20",
              borderColor: colors.success,
            },
          ]}
        >
          <IconSymbol
            name="checkmark.circle.fill"
            size={64}
            color={colors.success}
          />
          <ThemedText type="title" style={styles.successTitle}>
            Bill Pay Rule Created!
          </ThemedText>
          <ThemedText style={styles.successAmount}>
            {formatCurrency(successData.amount / 100)}
          </ThemedText>
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
              Create Another Rule
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
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
        title="Review Bill Pay Rule"
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

      <form.Field name="amount">
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
  successCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  successTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
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
});


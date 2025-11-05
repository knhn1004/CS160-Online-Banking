import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useForm } from "@tanstack/react-form";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { api } from "@/lib/api";
import { USStateTerritorySchema } from "@/lib/schemas/user";
import { FrequencySelector } from "@/components/transfers/frequency-selector";

const US_STATES = [
  { label: "Alabama", value: "AL" },
  { label: "Alaska", value: "AK" },
  { label: "Arizona", value: "AZ" },
  { label: "Arkansas", value: "AR" },
  { label: "California", value: "CA" },
  { label: "Colorado", value: "CO" },
  { label: "Connecticut", value: "CT" },
  { label: "Delaware", value: "DE" },
  { label: "District of Columbia", value: "DC" },
  { label: "Florida", value: "FL" },
  { label: "Georgia", value: "GA" },
  { label: "Hawaii", value: "HI" },
  { label: "Idaho", value: "ID" },
  { label: "Illinois", value: "IL" },
  { label: "Indiana", value: "IN" },
  { label: "Iowa", value: "IA" },
  { label: "Kansas", value: "KS" },
  { label: "Kentucky", value: "KY" },
  { label: "Louisiana", value: "LA" },
  { label: "Maine", value: "ME" },
  { label: "Maryland", value: "MD" },
  { label: "Massachusetts", value: "MA" },
  { label: "Michigan", value: "MI" },
  { label: "Minnesota", value: "MN" },
  { label: "Mississippi", value: "MS" },
  { label: "Missouri", value: "MO" },
  { label: "Montana", value: "MT" },
  { label: "Nebraska", value: "NE" },
  { label: "Nevada", value: "NV" },
  { label: "New Hampshire", value: "NH" },
  { label: "New Jersey", value: "NJ" },
  { label: "New Mexico", value: "NM" },
  { label: "New York", value: "NY" },
  { label: "North Carolina", value: "NC" },
  { label: "North Dakota", value: "ND" },
  { label: "Ohio", value: "OH" },
  { label: "Oklahoma", value: "OK" },
  { label: "Oregon", value: "OR" },
  { label: "Pennsylvania", value: "PA" },
  { label: "Rhode Island", value: "RI" },
  { label: "South Carolina", value: "SC" },
  { label: "South Dakota", value: "SD" },
  { label: "Tennessee", value: "TN" },
  { label: "Texas", value: "TX" },
  { label: "Utah", value: "UT" },
  { label: "Vermont", value: "VT" },
  { label: "Virginia", value: "VA" },
  { label: "Washington", value: "WA" },
  { label: "West Virginia", value: "WV" },
  { label: "Wisconsin", value: "WI" },
  { label: "Wyoming", value: "WY" },
  { label: "Puerto Rico", value: "PR" },
  { label: "Guam", value: "GU" },
  { label: "U.S. Virgin Islands", value: "VI" },
  { label: "American Samoa", value: "AS" },
  { label: "Northern Mariana Islands", value: "MP" },
];

interface CreatePayeeFormData {
  business_name: string;
  email: string;
  phone: string;
  street_address: string;
  address_line_2: string;
  city: string;
  state_or_territory: string;
  postal_code: string;
  country: string;
  account_number: string;
  routing_number: string;
}

export default function CreatePayeeScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const params = useLocalSearchParams<{ onSuccess?: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      business_name: "",
      email: "",
      phone: "",
      street_address: "",
      address_line_2: "",
      city: "",
      state_or_territory: "CA",
      postal_code: "",
      country: "United States",
      account_number: "",
      routing_number: "",
    } as CreatePayeeFormData,
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      setError(null);

      try {
        await api.createBillPayee({
          business_name: value.business_name,
          email: value.email,
          phone: value.phone,
          street_address: value.street_address,
          address_line_2: value.address_line_2 || undefined,
          city: value.city,
          state_or_territory: value.state_or_territory,
          postal_code: value.postal_code,
          country: value.country,
          account_number: value.account_number,
          routing_number: value.routing_number,
        });

        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Payee created successfully",
        });

        // Navigate back with the new payee ID
        router.back();
        
        // If there's a callback, call it with the payee ID
        if (params.onSuccess) {
          // The parent component will handle refreshing payees
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create payee";
        setError(errorMessage);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: errorMessage,
        });
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Create Payee",
          headerShown: true,
          headerBackTitle: "",
          headerTintColor: colors.text,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Payee Information
        </ThemedText>

        <form.Field
          name="business_name"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "Business name is required";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <View style={styles.field}>
              <ThemedText style={styles.label}>Business Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: field.state.meta.errors.length > 0
                      ? colors.destructive
                      : colors.border,
                    color: colors.text,
                  },
                ]}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder="Enter business name"
                placeholderTextColor={colors.mutedForeground}
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedText
                  style={[
                    styles.errorText,
                    {
                      color: colors.destructive,
                    },
                  ]}
                >
                  {field.state.meta.errors[0]}
                </ThemedText>
              )}
            </View>
          )}
        </form.Field>

        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "Email is required";
              }
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                return "Invalid email address";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <View style={styles.field}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: field.state.meta.errors.length > 0
                      ? colors.destructive
                      : colors.border,
                    color: colors.text,
                  },
                ]}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder="email@example.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedText
                  style={[
                    styles.errorText,
                    {
                      color: colors.destructive,
                    },
                  ]}
                >
                  {field.state.meta.errors[0]}
                </ThemedText>
              )}
            </View>
          )}
        </form.Field>

        <form.Field
          name="phone"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "Phone number is required";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <View style={styles.field}>
              <ThemedText style={styles.label}>Phone</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: field.state.meta.errors.length > 0
                      ? colors.destructive
                      : colors.border,
                    color: colors.text,
                  },
                ]}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder="+1234567890"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedText
                  style={[
                    styles.errorText,
                    {
                      color: colors.destructive,
                    },
                  ]}
                >
                  {field.state.meta.errors[0]}
                </ThemedText>
              )}
            </View>
          )}
        </form.Field>

        <form.Field
          name="street_address"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "Street address is required";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <View style={styles.field}>
              <ThemedText style={styles.label}>Street Address</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: field.state.meta.errors.length > 0
                      ? colors.destructive
                      : colors.border,
                    color: colors.text,
                  },
                ]}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder="123 Main St"
                placeholderTextColor={colors.mutedForeground}
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedText
                  style={[
                    styles.errorText,
                    {
                      color: colors.destructive,
                    },
                  ]}
                >
                  {field.state.meta.errors[0]}
                </ThemedText>
              )}
            </View>
          )}
        </form.Field>

        <form.Field name="address_line_2">
          {(field) => (
            <View style={styles.field}>
              <ThemedText style={styles.label}>Address Line 2 (Optional)</ThemedText>
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
                placeholder="Apt, Suite, etc."
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          )}
        </form.Field>

        <View style={styles.row}>
          <form.Field
            name="city"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim() === "") {
                  return "City is required";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <View style={[styles.field, styles.halfWidth]}>
                <ThemedText style={styles.label}>City</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: field.state.meta.errors.length > 0
                        ? colors.destructive
                        : colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  placeholder="City"
                  placeholderTextColor={colors.mutedForeground}
                />
                {field.state.meta.errors.length > 0 && (
                  <ThemedText
                    style={[
                      styles.errorText,
                      {
                        color: colors.destructive,
                      },
                    ]}
                  >
                    {field.state.meta.errors[0]}
                  </ThemedText>
                )}
              </View>
            )}
          </form.Field>

          <form.Field
            name="postal_code"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim() === "") {
                  return "Postal code is required";
                }
                if (value.length > 10) {
                  return "Postal code cannot exceed 10 characters";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <View style={[styles.field, styles.halfWidth]}>
                <ThemedText style={styles.label}>Postal Code</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: field.state.meta.errors.length > 0
                        ? colors.destructive
                        : colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  placeholder="12345"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  maxLength={10}
                />
                {field.state.meta.errors.length > 0 && (
                  <ThemedText
                    style={[
                      styles.errorText,
                      {
                        color: colors.destructive,
                      },
                    ]}
                  >
                    {field.state.meta.errors[0]}
                  </ThemedText>
                )}
              </View>
            )}
          </form.Field>
        </View>

        <form.Field
          name="state_or_territory"
          validators={{
            onChange: ({ value }) => {
              if (!value) {
                return "State/territory is required";
              }
              const result = USStateTerritorySchema.safeParse(value);
              if (!result.success) {
                return "Invalid state/territory";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <View style={styles.field}>
              <ThemedText style={styles.label}>State/Territory</ThemedText>
              <FrequencySelector
                options={US_STATES}
                selectedValue={field.state.value}
                onSelect={field.handleChange}
                label="Select State/Territory"
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
          name="account_number"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "Account number is required";
              }
              if (value.length > 17) {
                return "Account number cannot exceed 17 characters";
              }
              if (!/^\d+$/.test(value)) {
                return "Account number must contain only digits";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <View style={styles.field}>
              <ThemedText style={styles.label}>Account Number</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: field.state.meta.errors.length > 0
                      ? colors.destructive
                      : colors.border,
                    color: colors.text,
                  },
                ]}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder="Enter account number"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                maxLength={17}
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedText
                  style={[
                    styles.errorText,
                    {
                      color: colors.destructive,
                    },
                  ]}
                >
                  {field.state.meta.errors[0]}
                </ThemedText>
              )}
            </View>
          )}
        </form.Field>

        <form.Field
          name="routing_number"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "Routing number is required";
              }
              if (value.length !== 9) {
                return "Routing number must be exactly 9 digits";
              }
              if (!/^\d{9}$/.test(value)) {
                return "Routing number must contain only digits";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <View style={styles.field}>
              <ThemedText style={styles.label}>Routing Number</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: field.state.meta.errors.length > 0
                      ? colors.destructive
                      : colors.border,
                    color: colors.text,
                  },
                ]}
                value={field.state.value}
                onChangeText={field.handleChange}
                placeholder="123456789"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                maxLength={9}
              />
              {field.state.meta.errors.length > 0 && (
                <ThemedText
                  style={[
                    styles.errorText,
                    {
                      color: colors.destructive,
                    },
                  ]}
                >
                  {field.state.meta.errors[0]}
                </ThemedText>
              )}
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
              opacity: submitting ? 0.6 : 1,
            },
          ]}
          onPress={() => form.handleSubmit()}
          disabled={submitting}
        >
          {submitting ? (
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
              Create Payee
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  sectionTitle: {
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
    fontSize: 12,
    marginTop: 4,
    flex: 1,
  },
});


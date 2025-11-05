import { useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import Toast from "react-native-toast-message";
import { useForm } from "@tanstack/react-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { useProfile, useUpdateProfile } from "@/lib/queries";
import { UpdateProfileSchema } from "@/lib/schemas/user";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "PR", label: "Puerto Rico" },
  { value: "GU", label: "Guam" },
  { value: "VI", label: "U.S. Virgin Islands" },
  { value: "AS", label: "American Samoa" },
  { value: "MP", label: "Northern Mariana Islands" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = Colors[theme];

  // Use TanStack Query hooks
  const {
    data: profileData,
    isLoading,
    error: profileError,
  } = useProfile();
  const updateProfileMutation = useUpdateProfile();

  // Show error toast if profile query fails
  useEffect(() => {
    if (profileError) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2:
          profileError instanceof Error
            ? profileError.message
            : "Failed to load profile",
      });
    }
  }, [profileError]);

  // Initialize form with TanStack Form
  const form = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone_number: "",
      street_address: "",
      address_line_2: "",
      city: "",
      state_or_territory: "",
      postal_code: "",
    },
    onSubmit: async ({ value }) => {
      // Convert phone number to E.164 format
      const cleanPhone = value.phone_number.replace(/\D/g, "");
      const phoneForApi = `+1${cleanPhone}`;

      try {
        await updateProfileMutation.mutateAsync({
          first_name: value.first_name,
          last_name: value.last_name,
          phone_number: phoneForApi,
          street_address: value.street_address,
          address_line_2: value.address_line_2 || null,
          city: value.city,
          state_or_territory: value.state_or_territory,
          postal_code: value.postal_code,
        });

        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Profile updated successfully!",
        });
      } catch (err) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: err instanceof Error ? err.message : "Failed to update profile",
        });
      }
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profileData?.user) {
      const displayPhone = profileData.user.phone_number.startsWith("+1")
        ? profileData.user.phone_number.substring(2)
        : profileData.user.phone_number;

      form.setFieldValue("first_name", profileData.user.first_name);
      form.setFieldValue("last_name", profileData.user.last_name);
      form.setFieldValue("email", profileData.user.email);
      form.setFieldValue("phone_number", displayPhone);
      form.setFieldValue("street_address", profileData.user.street_address);
      form.setFieldValue(
        "address_line_2",
        profileData.user.address_line_2 || "",
      );
      form.setFieldValue("city", profileData.user.city);
      form.setFieldValue("state_or_territory", profileData.user.state_or_territory);
      form.setFieldValue("postal_code", profileData.user.postal_code);
    }
  }, [profileData?.user, form]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Account Information
        </ThemedText>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.form}>
          <form.Field
            name="first_name"
            validators={{
              onChange: ({ value }) => {
                if (!value) return "First name is required";
                return undefined;
              },
            }}
          >
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>First Name *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                    field.state.meta.errors.length > 0 && styles.inputError,
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder="First name"
                  placeholderTextColor={colors.text + "80"}
                />
                {field.state.meta.errors.length > 0 && (
                  <ThemedText style={styles.errorText}>
                    {field.state.meta.errors[0]}
                  </ThemedText>
                )}
              </View>
            )}
          </form.Field>

          <form.Field
            name="last_name"
            validators={{
              onChange: ({ value }) => {
                if (!value) return "Last name is required";
                return undefined;
              },
            }}
          >
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Last Name *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                    field.state.meta.errors.length > 0 && styles.inputError,
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder="Last name"
                  placeholderTextColor={colors.text + "80"}
                />
                {field.state.meta.errors.length > 0 && (
                  <ThemedText style={styles.errorText}>
                    {field.state.meta.errors[0]}
                  </ThemedText>
                )}
              </View>
            )}
          </form.Field>

          <form.Field name="email">
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputDisabled,
                    { color: colors.text + "80", borderColor: colors.border },
                  ]}
                  value={field.state.value}
                  editable={false}
                  placeholder="Email"
                  placeholderTextColor={colors.text + "80"}
                />
                <ThemedText style={styles.helperText}>
                  Email is managed by your account authentication
                </ThemedText>
              </View>
            )}
          </form.Field>

          <form.Field
            name="phone_number"
              validators={{
                onChange: ({ value }) => {
                  const cleanPhone = value.replace(/\D/g, "");
                  const phoneForValidation = `+1${cleanPhone}`;
                  const result = UpdateProfileSchema.shape.phone_number.safeParse(
                    phoneForValidation,
                  );
                  if (!result.success) {
                    return result.error.issues[0]?.message || "Invalid phone number";
                  }
                  return undefined;
                },
              }}
          >
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Phone Number *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                    field.state.meta.errors.length > 0 && styles.inputError,
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={colors.text + "80"}
                  keyboardType="phone-pad"
                />
                {field.state.meta.errors.length > 0 && (
                  <ThemedText style={styles.errorText}>
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
                if (!value) return "Street address is required";
                return undefined;
              },
            }}
          >
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Street Address *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                    field.state.meta.errors.length > 0 && styles.inputError,
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder="123 Main St"
                  placeholderTextColor={colors.text + "80"}
                />
                {field.state.meta.errors.length > 0 && (
                  <ThemedText style={styles.errorText}>
                    {field.state.meta.errors[0]}
                  </ThemedText>
                )}
              </View>
            )}
          </form.Field>

          <form.Field name="address_line_2">
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Address Line 2</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder="Apt 4B (optional)"
                  placeholderTextColor={colors.text + "80"}
                />
              </View>
            )}
          </form.Field>

          <form.Field
            name="city"
            validators={{
              onChange: ({ value }) => {
                if (!value) return "City is required";
                return undefined;
              },
            }}
          >
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>City *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                    field.state.meta.errors.length > 0 && styles.inputError,
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder="City"
                  placeholderTextColor={colors.text + "80"}
                />
                {field.state.meta.errors.length > 0 && (
                  <ThemedText style={styles.errorText}>
                    {field.state.meta.errors[0]}
                  </ThemedText>
                )}
              </View>
            )}
          </form.Field>

          <form.Field
            name="state_or_territory"
            validators={{
              onChange: ({ value }) => {
                if (!value) return "State/Territory is required";
                return undefined;
              },
            }}
          >
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>State/Territory *</ThemedText>
                <View
                  style={[
                    styles.pickerContainer,
                    { borderColor: colors.border },
                    field.state.meta.errors.length > 0 && styles.inputError,
                  ]}
                >
                  <Picker
                    selectedValue={field.state.value}
                    onValueChange={field.handleChange}
                    style={[styles.picker, { color: colors.text }]}
                  >
                    <Picker.Item label="Select a state" value="" />
                    {US_STATES.map((state) => (
                      <Picker.Item
                        key={state.value}
                        label={state.label}
                        value={state.value}
                      />
                    ))}
                  </Picker>
                </View>
                {field.state.meta.errors.length > 0 && (
                  <ThemedText style={styles.errorText}>
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
                const result = UpdateProfileSchema.shape.postal_code.safeParse(
                  value,
                );
                if (!result.success) {
                  return result.error.issues[0]?.message || "Invalid postal code";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Postal Code *</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                    field.state.meta.errors.length > 0 && styles.inputError,
                  ]}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder="12345"
                  placeholderTextColor={colors.text + "80"}
                  keyboardType="number-pad"
                />
                {field.state.meta.errors.length > 0 && (
                  <ThemedText style={styles.errorText}>
                    {field.state.meta.errors[0]}
                  </ThemedText>
                )}
              </View>
            )}
          </form.Field>

          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor:
                  theme === "dark" ? colors.card : colors.primary,
                borderWidth: theme === "dark" ? 1 : 0,
                borderColor:
                  theme === "dark" ? colors.primary : "transparent",
              },
              updateProfileMutation.isPending && styles.buttonDisabled,
            ]}
            onPress={() => form.handleSubmit()}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator
                color={theme === "dark" ? colors.primary : colors.primaryForeground}
              />
            ) : (
              <ThemedText
                style={[
                  styles.buttonText,
                  {
                    color:
                      theme === "dark"
                        ? colors.primary
                        : colors.primaryForeground,
                  },
                ]}
              >
                Save Changes
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 0,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "transparent",
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

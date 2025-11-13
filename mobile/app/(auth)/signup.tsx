import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/contexts/auth-context";
import { SignupSchema, USStateTerritorySchema } from "@/lib/schemas/user";
import { api } from "@/lib/api";

const US_STATES = USStateTerritorySchema.options;

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, user } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    streetAddress: "",
    addressLine2: "",
    city: "",
    stateOrTerritory: "",
    postalCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.replace("/(tabs)/(home)");
    }
  }, [user, router]);

  const validate = () => {
    const result = SignupSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        newErrors[path] = issue.message;
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // Create auth user with Supabase
      const { error: authError } = await signUp(
        formData.email,
        formData.password,
      );

      if (authError) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: authError.message,
        });
        setLoading(false);
        return;
      }

      // Onboard user to database
      const cleanPhoneNumber = formData.phoneNumber.replace(/\D/g, "");
      await api.onboardUser({
        username: formData.username,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: `+1${cleanPhoneNumber}`,
        street_address: formData.streetAddress,
        address_line_2: formData.addressLine2 || null,
        city: formData.city,
        state_or_territory: formData.stateOrTerritory,
        postal_code: formData.postalCode,
        country: "USA",
        role: "customer",
      });

      router.replace("/(tabs)/(home)");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Sign In
          </ThemedText>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Username *</ThemedText>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              value={formData.username}
              onChangeText={(text) => updateField("username", text)}
              placeholder="Choose a username"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
            {errors.username && (
              <ThemedText style={styles.errorText}>
                {errors.username}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email *</ThemedText>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => updateField("email", text)}
              placeholder="you@example.com"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            {errors.email && (
              <ThemedText style={styles.errorText}>{errors.email}</ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Password *</ThemedText>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              value={formData.password}
              onChangeText={(text) => updateField("password", text)}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
            />
            {errors.password && (
              <ThemedText style={styles.errorText}>
                {errors.password}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Confirm Password *</ThemedText>
            <TextInput
              style={[
                styles.input,
                errors.confirmPassword && styles.inputError,
              ]}
              value={formData.confirmPassword}
              onChangeText={(text) => updateField("confirmPassword", text)}
              placeholder="Confirm your password"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
            />
            {errors.confirmPassword && (
              <ThemedText style={styles.errorText}>
                {errors.confirmPassword}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>First Name *</ThemedText>
            <TextInput
              style={[styles.input, errors.firstName && styles.inputError]}
              value={formData.firstName}
              onChangeText={(text) => updateField("firstName", text)}
              placeholder="First name"
              placeholderTextColor="#999"
            />
            {errors.firstName && (
              <ThemedText style={styles.errorText}>
                {errors.firstName}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Last Name *</ThemedText>
            <TextInput
              style={[styles.input, errors.lastName && styles.inputError]}
              value={formData.lastName}
              onChangeText={(text) => updateField("lastName", text)}
              placeholder="Last name"
              placeholderTextColor="#999"
            />
            {errors.lastName && (
              <ThemedText style={styles.errorText}>
                {errors.lastName}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Phone Number *</ThemedText>
            <TextInput
              style={[styles.input, errors.phoneNumber && styles.inputError]}
              value={formData.phoneNumber}
              onChangeText={(text) => updateField("phoneNumber", text)}
              placeholder="(555) 123-4567"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
            {errors.phoneNumber && (
              <ThemedText style={styles.errorText}>
                {errors.phoneNumber}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Street Address *</ThemedText>
            <TextInput
              style={[styles.input, errors.streetAddress && styles.inputError]}
              value={formData.streetAddress}
              onChangeText={(text) => updateField("streetAddress", text)}
              placeholder="123 Main St"
              placeholderTextColor="#999"
            />
            {errors.streetAddress && (
              <ThemedText style={styles.errorText}>
                {errors.streetAddress}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Address Line 2</ThemedText>
            <TextInput
              style={styles.input}
              value={formData.addressLine2}
              onChangeText={(text) => updateField("addressLine2", text)}
              placeholder="Apt 4B (optional)"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>City *</ThemedText>
            <TextInput
              style={[styles.input, errors.city && styles.inputError]}
              value={formData.city}
              onChangeText={(text) => updateField("city", text)}
              placeholder="City"
              placeholderTextColor="#999"
            />
            {errors.city && (
              <ThemedText style={styles.errorText}>{errors.city}</ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>State *</ThemedText>
            <View
              style={[
                styles.pickerContainer,
                errors.stateOrTerritory && styles.inputError,
              ]}
            >
              <Picker
                selectedValue={formData.stateOrTerritory}
                onValueChange={(value) =>
                  updateField("stateOrTerritory", value)
                }
                style={styles.picker}
              >
                <Picker.Item label="Select a state" value="" />
                {US_STATES.map((state) => (
                  <Picker.Item key={state} label={state} value={state} />
                ))}
              </Picker>
            </View>
            {errors.stateOrTerritory && (
              <ThemedText style={styles.errorText}>
                {errors.stateOrTerritory}
              </ThemedText>
            )}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Postal Code *</ThemedText>
            <TextInput
              style={[styles.input, errors.postalCode && styles.inputError]}
              value={formData.postalCode}
              onChangeText={(text) => updateField("postalCode", text)}
              placeholder="12345"
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
            {errors.postalCode && (
              <ThemedText style={styles.errorText}>
                {errors.postalCode}
              </ThemedText>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Sign Up</ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push("/(auth)/login")}
          >
            <ThemedText style={styles.linkText}>
              Already have an account?{" "}
              <ThemedText style={styles.linkTextBold}>Sign in</ThemedText>
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </ScrollView>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginBottom: 24,
    textAlign: "center",
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
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  button: {
    backgroundColor: "#0a7ea4",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    textAlign: "center",
  },
  linkTextBold: {
    fontWeight: "600",
    color: "#0a7ea4",
  },
});

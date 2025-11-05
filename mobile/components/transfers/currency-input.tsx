import React from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
  error,
  disabled = false,
}: CurrencyInputProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const formatDisplayValue = (val: string): string => {
    // Remove all non-digit characters except decimal point
    const cleaned = val.replace(/[^\d.]/g, "");

    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }

    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + "." + parts[1].slice(0, 2);
    }

    return cleaned;
  };

  const handleChange = (text: string) => {
    const formatted = formatDisplayValue(text);
    onChange(formatted);
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
          },
          disabled && styles.disabled,
        ]}
      >
        <ThemedText style={styles.currencySymbol}>$</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
            },
          ]}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
          editable={!disabled}
          selectTextOnFocus={Platform.OS === "ios"}
        />
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: "500",
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});


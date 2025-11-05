import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";

// Custom toast components that match app theme
const SuccessToast = ({ text1, text2 }: { text1?: string; text2?: string }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <View
      style={[
        styles.toast,
        { backgroundColor: colors.card, borderLeftColor: colors.success },
      ]}
    >
      <Text style={[styles.text1, { color: colors.text }]}>{text1}</Text>
      {text2 && (
        <Text style={[styles.text2, { color: colors.text }]}>{text2}</Text>
      )}
    </View>
  );
};

const ErrorToast = ({ text1, text2 }: { text1?: string; text2?: string }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <View
      style={[
        styles.toast,
        { backgroundColor: colors.card, borderLeftColor: colors.destructive },
      ]}
    >
      <Text style={[styles.text1, { color: colors.text }]}>{text1}</Text>
      {text2 && (
        <Text style={[styles.text2, { color: colors.text }]}>{text2}</Text>
      )}
    </View>
  );
};

const InfoToast = ({ text1, text2 }: { text1?: string; text2?: string }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <View
      style={[
        styles.toast,
        { backgroundColor: colors.card, borderLeftColor: colors.primary },
      ]}
    >
      <Text style={[styles.text1, { color: colors.text }]}>{text1}</Text>
      {text2 && (
        <Text style={[styles.text2, { color: colors.text }]}>{text2}</Text>
      )}
    </View>
  );
};

// Custom toast configuration that matches app theme
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toast
        topOffset={80}
        config={{
          success: ({ text1, text2 }) => (
            <SuccessToast text1={text1} text2={text2} />
          ),
          error: ({ text1, text2 }) => (
            <ErrorToast text1={text1} text2={text2} />
          ),
          info: ({ text1, text2 }) => <InfoToast text1={text1} text2={text2} />,
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  toast: {
    height: 60,
    width: "90%",
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    justifyContent: "center",
  },
  text1: {
    fontSize: 15,
    fontWeight: "600",
  },
  text2: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.7,
  },
});

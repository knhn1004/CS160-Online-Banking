import { Stack } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { CheckDepositForm } from "@/components/transfers/check-deposit-form";

export default function CheckDepositScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Check Deposit",
          headerShown: true,
          headerBackTitle: "",
        }}
      />
      <CheckDepositForm />
    </ThemedView>
  );
}


import { Stack } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ExternalTransferForm } from "@/components/transfers/external-transfer-form";

export default function ExternalTransferScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "External Transfer",
          headerShown: true,
          headerBackTitle: "",
        }}
      />
      <ExternalTransferForm />
    </ThemedView>
  );
}


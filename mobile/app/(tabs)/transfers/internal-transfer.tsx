import { Stack } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { InternalTransferForm } from "@/components/transfers/internal-transfer-form";

export default function InternalTransferScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Internal Transfer",
          headerShown: true,
          headerBackTitle: "",
        }}
      />
      <InternalTransferForm />
    </ThemedView>
  );
}


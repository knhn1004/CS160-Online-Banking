import { Stack } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { BillPayForm } from "@/components/transfers/billpay-form";

export default function BillPayTransferScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Bill Pay",
          headerShown: true,
          headerBackTitle: "",
        }}
      />
      <BillPayForm />
    </ThemedView>
  );
}


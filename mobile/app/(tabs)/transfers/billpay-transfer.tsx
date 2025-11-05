import { Stack, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { BillPayForm } from "@/components/transfers/billpay-form";

export default function BillPayTransferScreen() {
  const params = useLocalSearchParams<{ ruleId?: string }>();
  const ruleId = params.ruleId ? parseInt(params.ruleId, 10) : undefined;

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: ruleId ? "Edit Bill Pay Rule" : "Bill Pay",
          headerShown: true,
          headerBackTitle: "",
        }}
      />
      <BillPayForm ruleId={ruleId} />
    </ThemedView>
  );
}


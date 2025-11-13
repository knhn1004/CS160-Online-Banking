import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function TransfersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        headerBackTitle: Platform.OS === "ios" ? "" : undefined,
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          title: "Transfers",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="internal-transfer"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="external-transfer"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="billpay-transfer"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="billpay-rules"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="check-deposit"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="transfer-history"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="create-payee"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="api-keys"
        options={{
          title: "API Keys",
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
    </Stack>
  );
}


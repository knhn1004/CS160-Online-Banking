import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function HomeLayout() {
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
          title: "Home",
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="account-detail"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
        }}
      />
    </Stack>
  );
}

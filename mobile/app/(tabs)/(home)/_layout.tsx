import { Stack } from "expo-router";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";

export default function HomeLayout() {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="account-detail"
        options={{
          headerShown: true,
          animation: "slide_from_right",
          headerBackTitle: "",
          headerBackTitleVisible: false,
        }}
      />
    </Stack>
  );
}

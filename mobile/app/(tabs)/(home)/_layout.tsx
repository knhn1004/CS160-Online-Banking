import { Stack } from "expo-router";
import { Platform } from "react-native";
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
          headerBackTitleVisible: false,
        }}
      />
    </Stack>
  );
}

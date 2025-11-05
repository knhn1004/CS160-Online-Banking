import React from "react";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { View, StyleSheet, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ThemedText } from "@/components/themed-text";

export function FloatingTab(props: BottomTabBarButtonProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const focused = props.accessibilityState?.selected === true;

  return (
    <View style={styles.wrapper}>
      <PlatformPressable
        {...(props as any)}
        style={({ pressed }: { pressed: boolean }) => {
          const styleArray = [
            styles.button,
            {
              backgroundColor: colors.primary,
              zIndex: 2,
            } as ViewStyle,
            pressed && styles.pressed,
          ].filter(Boolean);
          return styleArray as any;
        }}
        onPressIn={(ev) => {
          if (process.env.EXPO_OS === "ios") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          props.onPressIn?.(ev);
        }}
      >
        <IconSymbol
          size={28}
          name="chevron.right"
          color={colors.cardForeground}
        />
      </PlatformPressable>
      <ThemedText
        style={{
          marginTop: 6,
          fontSize: 12,
          color: focused ? colors.tint : colors.tabIconDefault,
        }}
      >
        Transfers
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: -18,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  pressed: {
    transform: [{ scale: 0.9 }],
  },
});

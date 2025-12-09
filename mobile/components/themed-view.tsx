import { View, type ViewProps } from "react-native";
import { type ReactNode, isValidElement } from "react";

import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedViewProps = Omit<ViewProps, "children"> & {
  lightColor?: string;
  darkColor?: string;
  children?: ReactNode;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  children,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    "background",
  );

  // Filter out any raw strings to prevent React Native errors
  // React Native requires all text to be wrapped in <Text> components
  const safeChildren = (() => {
    if (children === null || children === undefined || typeof children === "boolean") {
      return children;
    }
    
    if (typeof children === "string" || typeof children === "number") {
      // Don't render raw strings/numbers - this is a developer error
      // but we'll silently ignore it to prevent crashes during network errors
      if (__DEV__) {
        console.warn(
          "ThemedView: Received raw string/number as children. Text must be wrapped in <Text> component.",
          children,
        );
      }
      return null;
    }
    
    if (Array.isArray(children)) {
      return children.filter(
        (child) =>
          child === null ||
          child === undefined ||
          typeof child === "boolean" ||
          isValidElement(child),
      );
    }
    
    if (isValidElement(children)) {
      return children;
    }
    
    // Fallback for any other type
    return null;
  })();

  return (
    <View style={[{ backgroundColor }, style]} {...otherProps}>
      {safeChildren}
    </View>
  );
}

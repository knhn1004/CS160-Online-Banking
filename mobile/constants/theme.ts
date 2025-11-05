/**
 * Colors matching the web app theme
 * Converted from OKLCH to approximate hex values
 */

import { Platform } from "react-native";

// Light theme colors (from web app)
const tintColorLight = "#2563eb"; // Primary blue: oklch(0.4 0.15 250)
const tintColorDark = "#fbcfe8"; // Primary pink/rose: oklch(0.85 0.08 15)

export const Colors = {
  light: {
    text: "#1e293b", // Foreground: oklch(0.15 0.01 250)
    background: "#fefefe", // Background: oklch(0.99 0.005 10)
    tint: tintColorLight,
    icon: "#64748b",
    tabIconDefault: "#94a3b8",
    tabIconSelected: tintColorLight,
    card: "#ffffff", // Card: oklch(1 0 0)
    cardForeground: "#1e293b",
    border: "#e2e8f0", // Border: oklch(0.9 0.005 10)
    muted: "#f1f5f9", // Muted: oklch(0.96 0.005 10)
    mutedForeground: "#64748b", // Muted foreground: oklch(0.5 0.01 250)
    primary: tintColorLight,
    primaryForeground: "#ffffff",
    secondary: "#f1f5f9", // Secondary: oklch(0.96 0.005 10)
    secondaryForeground: "#334155",
    accent: "#3b82f6", // Accent: oklch(0.55 0.2 250)
    accentForeground: "#ffffff",
    success: "#14b8a6", // Success: oklch(0.65 0.18 162)
    warning: "#f97316", // Warning: oklch(0.7 0.15 45)
    destructive: "#ef4444", // Destructive: oklch(0.6 0.24 25)
  },
  dark: {
    text: "#ffffff", // Foreground: oklch(1 0 0)
    background: "#1e293b", // Background: oklch(0.25 0.05 260) - dark blue-gray
    tint: tintColorDark,
    icon: "#cbd5e1",
    tabIconDefault: "#94a3b8",
    tabIconSelected: tintColorDark,
    card: "#334155", // Card: oklch(0.28 0.04 260)
    cardForeground: "#ffffff",
    border: "#475569", // Border: oklch(0.35 0.04 265)
    muted: "#0f172a", // Muted: oklch(0.18 0.05 260)
    mutedForeground: "#cbd5e1", // Muted foreground: oklch(0.82 0.08 260)
    primary: tintColorDark,
    primaryForeground: "#1e293b",
    secondary: "#e0e7ff", // Secondary: oklch(0.9 0.06 260) - light lavender blue
    secondaryForeground: "#1e293b",
    accent: tintColorDark,
    accentForeground: "#1e293b",
    success: "#14b8a6", // Success: oklch(0.65 0.18 162)
    warning: "#fb923c", // Warning: oklch(0.68 0.15 45)
    destructive: "#ef4444", // Destructive: oklch(0.55 0.2 25)
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

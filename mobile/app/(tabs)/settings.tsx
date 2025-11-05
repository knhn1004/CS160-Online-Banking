import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { Colors } from "@/constants/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { signOut } = useAuth();
  const colors = Colors[theme];

  const handleLogout = async () => {
    await signOut();
    Toast.show({
      type: "info",
      text1: "Logged out",
      text2: "You have been successfully logged out",
    });
    router.replace("/(auth)/login");
  };

  const toggleTheme = (value: boolean) => {
    setThemeMode(value ? "dark" : "light");
  };

  const setSystemTheme = () => {
    setThemeMode("system");
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Settings
        </ThemedText>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >

        {/* Appearance Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Appearance
          </ThemedText>

          <ThemedView
            style={[styles.settingCard, { borderColor: colors.border }]}
          >
            <View
              style={[styles.settingRow, { borderBottomColor: colors.border }]}
            >
              <View style={styles.settingInfo}>
                <ThemedText style={styles.settingLabel}>Dark Mode</ThemedText>
                <ThemedText style={styles.settingDescription}>
                  {themeMode === "system"
                    ? "Following system settings"
                    : themeMode === "dark"
                      ? "Dark mode enabled"
                      : "Light mode enabled"}
                </ThemedText>
              </View>
              <Switch
                value={theme === "dark"}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={
                  theme === "dark"
                    ? colors.primaryForeground
                    : colors.mutedForeground
                }
              />
            </View>

            {themeMode !== "system" && (
              <TouchableOpacity
                style={[
                  styles.settingRow,
                  { borderBottomColor: colors.border },
                ]}
                onPress={setSystemTheme}
                activeOpacity={0.7}
              >
                <View style={styles.settingInfo}>
                  <ThemedText style={styles.settingLabel}>
                    Use System Theme
                  </ThemedText>
                  <ThemedText style={styles.settingDescription}>
                    Match your device settings
                  </ThemedText>
                </View>
                <IconSymbol
                  name="chevron.right"
                  size={20}
                  color={colors.icon}
                />
              </TouchableOpacity>
            )}
          </ThemedView>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Account
          </ThemedText>

          <ThemedView
            style={[styles.settingCard, { borderColor: colors.border }]}
          >
            <TouchableOpacity
              style={styles.settingRow}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={styles.settingInfo}>
                <ThemedText style={styles.settingLabel}>Log Out</ThemedText>
                <ThemedText style={styles.settingDescription}>
                  Sign out of your account
                </ThemedText>
              </View>
              <IconSymbol
                name="arrow.right.square"
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
          </ThemedView>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "600",
  },
  settingCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
});

import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch,
} from "react-native";
import { useState, useEffect } from "react";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { api } from "@/lib/api";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AccountSelector } from "@/components/transfers/account-selector";
import type { InternalAccount } from "@/lib/api";

interface ApiKey {
  id: number;
  key_prefix: string;
  account_id: number;
  account_number: string;
  account_type: "checking" | "savings";
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiKeysScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [neverExpires, setNeverExpires] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchAccounts(), fetchApiKeys()]);
  };

  const fetchAccounts = async () => {
    try {
      const data = await api.getAccounts();
      const activeAccounts = (data.accounts || []).filter((acc) => acc.is_active);
      setAccounts(activeAccounts);
      if (activeAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(activeAccounts[0].id);
      }
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err instanceof Error ? err.message : "Failed to load accounts",
      });
    }
  };

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const data = await api.getApiKeys();
      setApiKeys(data.api_keys || []);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err instanceof Error ? err.message : "Failed to load API keys",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedAccountId) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Please select an account",
      });
      return;
    }

    try {
      setGenerating(true);

      const requestBody: {
        account_id: number;
        expires_at?: string | null;
      } = {
        account_id: selectedAccountId,
      };

      if (!neverExpires && expiresAt) {
        requestBody.expires_at = new Date(expiresAt).toISOString();
      } else if (neverExpires) {
        requestBody.expires_at = null;
      }

      const data = await api.generateApiKey(requestBody);
      setGeneratedKey(data.api_key);
      setShowGenerateForm(false);
      setSelectedAccountId(accounts[0]?.id || null);
      setExpiresAt("");
      setNeverExpires(false);

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "API key generated successfully",
      });

      await fetchApiKeys();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err instanceof Error ? err.message : "Failed to generate API key",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: number) => {
    Alert.alert(
      "Revoke API Key",
      "Are you sure you want to revoke this API key? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              setRevokingId(keyId);
              await api.revokeApiKey(keyId);
              Toast.show({
                type: "success",
                text1: "Success",
                text2: "API key revoked successfully",
              });
              await fetchApiKeys();
            } catch (err) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: err instanceof Error ? err.message : "Failed to revoke API key",
              });
            } finally {
              setRevokingId(null);
            }
          },
        },
      ],
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never expires";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Toast.show({
      type: "info",
      text1: "Copied",
      text2: "API key copied to clipboard",
    });
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Generate New API Key Button */}
        <TouchableOpacity
          style={[
            styles.generateButton,
            {
              backgroundColor: colors.primary,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setShowGenerateForm(!showGenerateForm)}
        >
          <ThemedText
            style={[styles.generateButtonText, { color: colors.primaryForeground }]}
          >
            {showGenerateForm ? "Cancel" : "Generate New API Key"}
          </ThemedText>
        </TouchableOpacity>

        {/* Generate Form */}
        {showGenerateForm && (
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <ThemedText type="subtitle" style={styles.formTitle}>
              Generate API Key
            </ThemedText>

            <View style={styles.formGroup}>
              <AccountSelector
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onSelect={(accountId) => setSelectedAccountId(accountId)}
                label="Select Account"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <ThemedText style={styles.label}>Never expires</ThemedText>
                <Switch
                  value={neverExpires}
                  onValueChange={setNeverExpires}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={neverExpires ? colors.primaryForeground : colors.mutedForeground}
                />
              </View>
            </View>

            {!neverExpires && (
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Expiration Date & Time</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  placeholder="YYYY-MM-DDTHH:mm"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: colors.primary,
                  opacity: generating ? 0.6 : 1,
                },
              ]}
              onPress={handleGenerate}
              disabled={generating || !selectedAccountId}
            >
              {generating ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <ThemedText
                  style={[styles.submitButtonText, { color: colors.primaryForeground }]}
                >
                  Generate
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Generated Key Alert */}
        {generatedKey && (
          <View
            style={[
              styles.alertCard,
              {
                backgroundColor: colors.accent + "20",
                borderColor: colors.accent,
              },
            ]}
          >
            <ThemedText type="subtitle" style={styles.alertTitle}>
              API Key Generated
            </ThemedText>
            <ThemedText style={styles.alertText}>
              Copy this key now - you won&apos;t be able to see it again!
            </ThemedText>
            <View style={styles.keyContainer}>
              <ThemedText style={[styles.keyText, { fontFamily: "monospace" }]}>
                {generatedKey}
              </ThemedText>
              <TouchableOpacity
                onPress={() => copyToClipboard(generatedKey)}
                style={styles.copyButton}
              >
                <IconSymbol name="doc.on.doc" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.dismissButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => setGeneratedKey(null)}
            >
              <ThemedText
                style={[styles.dismissButtonText, { color: colors.primaryForeground }]}
              >
                I&apos;ve copied the key
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* API Keys List */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Your API Keys
          </ThemedText>

          {apiKeys.length === 0 ? (
            <ThemedText style={styles.emptyText}>No API keys found</ThemedText>
          ) : (
            <View style={styles.keysList}>
              {apiKeys.map((key) => (
                <View
                  key={key.id}
                  style={[
                    styles.keyCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.keyCardHeader}>
                    <ThemedText style={[styles.keyPrefix, { fontFamily: "monospace" }]}>
                      {key.key_prefix}...
                    </ThemedText>
                    {!key.is_active && (
                      <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
                        <ThemedText style={styles.badgeText}>Revoked</ThemedText>
                      </View>
                    )}
                    {key.expires_at && new Date(key.expires_at) < new Date() && (
                      <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
                        <ThemedText style={styles.badgeText}>Expired</ThemedText>
                      </View>
                    )}
                  </View>

                  <View style={styles.keyDetails}>
                    <ThemedText style={styles.keyDetailText}>
                      Account: {key.account_type.charAt(0).toUpperCase() +
                        key.account_type.slice(1)} - ****{key.account_number.slice(-4)}
                    </ThemedText>
                    <ThemedText style={styles.keyDetailText}>
                      Expires: {formatDate(key.expires_at)}
                    </ThemedText>
                    {key.last_used_at && (
                      <ThemedText style={styles.keyDetailText}>
                        Last used: {formatDate(key.last_used_at)}
                      </ThemedText>
                    )}
                    <ThemedText style={styles.keyDetailText}>
                      Created: {formatDate(key.created_at)}
                    </ThemedText>
                  </View>

                  {key.is_active && (
                    <TouchableOpacity
                      style={[
                        styles.revokeButton,
                        {
                          backgroundColor: colors.destructive,
                          opacity: revokingId === key.id ? 0.6 : 1,
                        },
                      ]}
                      onPress={() => handleRevoke(key.id)}
                      disabled={revokingId === key.id}
                    >
                      {revokingId === key.id ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <ThemedText
                          style={[
                            styles.revokeButtonText,
                            { color: "#ffffff" },
                          ]}
                        >
                          Revoke
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  generateButton: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: "center",
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  formCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  formTitle: {
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  submitButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  alertCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  alertTitle: {
    marginBottom: 6,
  },
  alertText: {
    marginBottom: 10,
    fontSize: 13,
  },
  keyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  keyText: {
    flex: 1,
    fontSize: 11,
  },
  copyButton: {
    padding: 6,
  },
  dismissButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.7,
    marginTop: 12,
  },
  keysList: {
    gap: 10,
  },
  keyCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  keyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  keyPrefix: {
    fontSize: 13,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#fff",
  },
  keyDetails: {
    marginBottom: 10,
  },
  keyDetailText: {
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 3,
  },
  revokeButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  revokeButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});


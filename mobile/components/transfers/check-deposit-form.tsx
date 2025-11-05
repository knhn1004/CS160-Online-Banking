import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { useAccounts, queryKeys } from "@/lib/queries";
import { api } from "@/lib/api";
import { AccountSelector } from "./account-selector";

type FormState =
  | "idle"
  | "selecting"
  | "uploading"
  | "processing"
  | "success"
  | "error";

export function CheckDepositForm() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const [formState, setFormState] = useState<FormState>("idle");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    transaction_id?: number;
    amount?: number;
    validation_result?: {
      extracted_amount: number;
      routing_number?: string;
      account_number?: string;
      check_number?: string;
      payee_name?: string;
      payor_name?: string;
    };
  } | null>(null);

  const accounts = useMemo(
    () => accountsData?.accounts || [],
    [accountsData?.accounts],
  );

  useEffect(() => {
    // Request camera permissions
    (async () => {
      if (Platform.OS !== "web") {
        const { status: cameraStatus } =
          await ImagePicker.requestCameraPermissionsAsync();
        const { status: mediaStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (cameraStatus !== "granted" || mediaStatus !== "granted") {
          Alert.alert(
            "Permissions Required",
            "Camera and photo library permissions are required to deposit checks.",
          );
        }
      }
    })();
  }, []);

  useEffect(() => {
    // Auto-select first checking account if available
    if (accounts.length > 0 && !selectedAccountId) {
      const checkingAccount = accounts.find(
        (acc) => acc.account_type === "checking" && acc.is_active,
      );
      if (checkingAccount) {
        setSelectedAccountId(checkingAccount.id);
      } else if (accounts[0]?.is_active) {
        setSelectedAccountId(accounts[0].id);
      }
    }
  }, [accounts, selectedAccountId]);

  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setError(null);
      }
    } catch {
      setError("Failed to take photo. Please try again.");
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to take photo. Please try again.",
      });
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setError(null);
      }
    } catch {
      setError("Failed to pick image. Please try again.");
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to pick image. Please try again.",
      });
    }
  };

  const handleUpload = async () => {
    if (!imageUri || !selectedAccountId) {
      setError("Please select an account and upload a check image");
      return;
    }

    try {
      setFormState("uploading");
      setError(null);

      const selectedAccount = accounts.find(
        (acc) => acc.id === selectedAccountId,
      );
      if (!selectedAccount) {
        throw new Error("Selected account not found");
      }

      // Determine file type from URI
      const fileExtension = imageUri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType =
        fileExtension === "png"
          ? "image/png"
          : fileExtension === "webp"
            ? "image/webp"
            : "image/jpeg";

      // Upload image
      const uploadResult = await api.uploadCheckImage({
        uri: imageUri,
        type: mimeType,
        name: `check-${Date.now()}.${fileExtension}`,
      });

      // Process deposit
      setFormState("processing");

      const depositResult = await api.depositCheck({
        check_image_url: uploadResult.image_url,
        destination_account_number: selectedAccount.account_number,
      });

      if (depositResult.error) {
        const errorMessage = depositResult.message || depositResult.error;
        throw new Error(errorMessage);
      }

      setSuccessData({
        transaction_id: depositResult.transaction_id,
        amount: depositResult.amount,
        validation_result: depositResult.validation_result,
      });

      // Invalidate account and transaction queries to refresh balances
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      // Invalidate all transfer history queries
      queryClient.invalidateQueries({ queryKey: ["transferHistory"] });

      setFormState("success");
      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Check deposit processed successfully",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to process check deposit";
      setError(errorMessage);
      setFormState("error");
      Toast.show({
        type: "error",
        text1: "Error",
        text2: errorMessage,
      });
    }
  };

  const handleReset = () => {
    setImageUri(null);
    setFormState("idle");
    setError(null);
    setSuccessData(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (accountsLoading || accounts.length === 0) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading accounts...</ThemedText>
      </ThemedView>
    );
  }

  if (formState === "success" && successData) {
    return (
      <>
        {/* Render the form in the background */}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
        >
        </ScrollView>

        {/* Full-screen success modal */}
        <Modal
          visible={formState === "success"}
          animationType="slide"
          transparent={false}
          onRequestClose={handleReset}
        >
          <ThemedView
            style={[
              styles.successModalContainer,
              {
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.successContent}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleReset}
              >
                <IconSymbol name="xmark" size={24} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.successContentInner}>
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={80}
                  color={colors.success}
                />
                <View style={styles.successTitleContainer}>
                  <ThemedText type="title" style={styles.successTitle}>
                    Check Deposit Successful!
                  </ThemedText>
                </View>
                <View style={styles.successAmountContainer}>
                  {successData.amount && (
                    <ThemedText style={styles.successAmount}>
                      {formatCurrency(successData.amount / 100)}
                    </ThemedText>
                  )}
                </View>
                <View style={styles.successDetails}>
                  {successData.validation_result && (
                    <>
                      {successData.validation_result.payor_name && (
                        <ThemedText
                          style={[
                            styles.successDetail,
                            {
                              color: colors.mutedForeground,
                            },
                          ]}
                        >
                          From: {successData.validation_result.payor_name}
                        </ThemedText>
                      )}
                      {successData.validation_result.routing_number && (
                        <ThemedText
                          style={[
                            styles.successDetail,
                            {
                              color: colors.mutedForeground,
                            },
                          ]}
                        >
                          Routing: {successData.validation_result.routing_number}
                        </ThemedText>
                      )}
                    </>
                  )}
                  {successData.transaction_id && (
                    <ThemedText
                      style={[
                        styles.successDetail,
                        {
                          color: colors.mutedForeground,
                          fontSize: 12,
                        },
                      ]}
                    >
                      Transaction ID: {successData.transaction_id}
                    </ThemedText>
                  )}
                </View>
                <View style={styles.successButtons}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.secondaryButton,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      handleReset();
                      router.push("/(tabs)/transfers/transfer-history");
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.buttonText,
                        {
                          color: colors.text,
                        },
                      ]}
                    >
                      View History
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor: colors.accent,
                      },
                    ]}
                    onPress={handleReset}
                  >
                    <ThemedText
                      style={[
                        styles.buttonText,
                        {
                          color: colors.accentForeground,
                        },
                      ]}
                    >
                      Deposit Another Check
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </ThemedView>
        </Modal>
      </>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.field}>
        <AccountSelector
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelect={setSelectedAccountId}
          label="Deposit To Account"
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.label}>Check Image</ThemedText>
        {!imageUri ? (
          <View style={styles.imageButtons}>
            <TouchableOpacity
              style={[
                styles.imageButton,
                {
                  backgroundColor: colors.accent,
                },
              ]}
              onPress={handleTakePhoto}
            >
              <IconSymbol
                name="camera.fill"
                size={24}
                color={colors.accentForeground}
              />
              <ThemedText
                style={[
                  styles.imageButtonText,
                  {
                    color: colors.accentForeground,
                  },
                ]}
              >
                Take Photo
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.imageButton,
                {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
              onPress={handlePickImage}
            >
              <IconSymbol name="photo.fill" size={24} color={colors.text} />
              <ThemedText
                style={[
                  styles.imageButtonText,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Select Photo
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <TouchableOpacity
              style={[
                styles.removeImageButton,
                {
                  backgroundColor: colors.destructive,
                },
              ]}
              onPress={() => setImageUri(null)}
            >
              <IconSymbol name="xmark" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {error && (
        <ThemedView
          style={[
            styles.errorCard,
            {
              backgroundColor: colors.destructive + "20",
              borderColor: colors.destructive,
            },
          ]}
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={20}
            color={colors.destructive}
          />
          <ThemedText
            style={[
              styles.errorText,
              {
                color: colors.destructive,
              },
            ]}
          >
            {error}
          </ThemedText>
        </ThemedView>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: colors.accent,
            opacity:
              formState === "uploading" ||
              formState === "processing" ||
              !imageUri ||
              !selectedAccountId
                ? 0.6
                : 1,
          },
        ]}
        onPress={handleUpload}
        disabled={
          formState === "uploading" ||
          formState === "processing" ||
          !imageUri ||
          !selectedAccountId
        }
      >
        {formState === "uploading" || formState === "processing" ? (
          <>
            <ActivityIndicator color={colors.accentForeground} />
            <ThemedText
              style={[
                styles.buttonText,
                {
                  color: colors.accentForeground,
                  marginLeft: 8,
                },
              ]}
            >
              {formState === "uploading" ? "Uploading..." : "Processing..."}
            </ThemedText>
          </>
        ) : (
          <ThemedText
            style={[
              styles.buttonText,
              {
                color: colors.accentForeground,
              },
            ]}
          >
            Deposit Check
          </ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  imageButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  imageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 56,
  },
  imageButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  imagePreviewContainer: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  imagePreview: {
    width: "100%",
    height: 300,
    resizeMode: "contain",
    backgroundColor: "#f8f9fa",
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 48,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  successModalContainer: {
    flex: 1,
  },
  successContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  successContentInner: {
    alignItems: "center",
    width: "100%",
    flex: 1,
    justifyContent: "center",
  },
  successTitleContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 0,
    paddingBottom: 0,
    minHeight: 60,
  },
  successAmountContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 32,
    marginBottom: 24,
    paddingTop: 0,
    minHeight: 50,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: 8,
    marginBottom: 16,
  },
  successTitle: {
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: 42,
  },
  successAmount: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: 48,
  },
  successDetails: {
    width: "100%",
    marginBottom: 24,
    gap: 8,
  },
  successDetail: {
    fontSize: 14,
    textAlign: "center",
  },
  successButtons: {
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    borderWidth: 1,
  },
});


import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  ActionSheetIOS,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/contexts/theme-context";
import { Colors } from "@/constants/theme";
import { searchNearbyATMs, geocodeAddress } from "@/lib/atm";
import type { AtmLocation } from "@/lib/types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GoogleMapsWebView } from "@/components/maps/google-maps-webview";

export default function AtmLocatorScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const [atms, setAtms] = useState<AtmLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchAddress, setSearchAddress] = useState("");
  const [selectedAtm, setSelectedAtm] = useState<AtmLocation | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const cardPositions = useRef<{ [key: string]: number }>({});

  const searchATMs = useCallback(async (lat: number, lng: number) => {
    try {
      setLoading(true);
      setError(null);
      const results = await searchNearbyATMs(lat, lng);
      setAtms(results);

      if (results.length === 0) {
        Toast.show({
          type: "info",
          text1: "No ATMs Found",
          text2: "No Chase ATMs found in this area",
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to search for ATMs";
      setError(errorMessage);
      Toast.show({
        type: "error",
        text1: "Search Error",
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError(
          "Location permission denied. Please enter an address to search.",
        );
        return;
      }

      setLoading(true);
      setError(null);

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      setUserLocation(coords);
      await searchATMs(coords.lat, coords.lng);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get location";
      setError(errorMessage);
      Toast.show({
        type: "error",
        text1: "Location Error",
        text2: errorMessage,
      });
      setLoading(false);
    }
  }, [searchATMs]);

  // Request user's current location on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const handleAddressSearch = useCallback(async () => {
    if (!searchAddress.trim()) {
      Toast.show({
        type: "error",
        text1: "Invalid Input",
        text2: "Please enter an address",
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await geocodeAddress(searchAddress);
      const coords = { lat: result.lat, lng: result.lng };
      setUserLocation(coords);
      await searchATMs(result.lat, result.lng);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to geocode address";
      setError(errorMessage);
      Toast.show({
        type: "error",
        text1: "Geocoding Error",
        text2: errorMessage,
      });
      setLoading(false);
    }
  }, [searchATMs, searchAddress]);

  const formatDistance = (distance?: number) => {
    if (!distance) return "Unknown distance";
    if (distance < 0.1) return "< 0.1 mi";
    return `${distance.toFixed(1)} mi`;
  };

  const openInMaps = (atm: AtmLocation) => {
    const { lat, lng } = atm.geometry.location;
    const name = encodeURIComponent(atm.name);

    const appleMapsUrl = `http://maps.apple.com/?q=${name}&ll=${lat},${lng}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    const openAppleMaps = () => {
      Linking.openURL(appleMapsUrl).catch(() => {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Could not open Apple Maps",
        });
      });
    };

    const openGoogleMaps = () => {
      Linking.openURL(googleMapsUrl).catch(() => {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Could not open Google Maps",
        });
      });
    };

    if (Platform.OS === "ios") {
      // Use ActionSheet on iOS
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Open in Apple Maps", "Open in Google Maps"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openAppleMaps();
          } else if (buttonIndex === 2) {
            openGoogleMaps();
          }
        },
      );
    } else {
      // Use Alert on Android
      Alert.alert("Open in Maps", "Choose a map app", [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Google Maps",
          onPress: openGoogleMaps,
        },
        {
          text: "Other Maps App",
          onPress: openGoogleMaps, // Android will let user choose from installed apps
        },
      ]);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
          },
        ]}
      >
        <ThemedText type="title" style={styles.title}>
          ATM Locator
        </ThemedText>
      </View>
      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingTop: 16,
          },
        ]}
      >
        <View style={styles.searchInputContainer}>
          <TextInput
            style={[
              styles.searchInput,
              { color: colors.text, borderColor: colors.border },
            ]}
            placeholder="Enter address or use current location"
            placeholderTextColor={colors.text + "80"}
            value={searchAddress}
            onChangeText={setSearchAddress}
            onSubmitEditing={handleAddressSearch}
          />
          <TouchableOpacity
            style={[
              styles.locationIconButton,
              {
                backgroundColor: loading
                  ? colors.accent + "20"
                  : colors.accent + "15",
              },
            ]}
            onPress={requestLocation}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <IconSymbol
                name="location.fill"
                size={18}
                color={colors.accent}
              />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.searchButton,
            {
              backgroundColor: theme === "dark" ? colors.card : colors.primary,
              borderWidth: theme === "dark" ? 1 : 0,
              borderColor: theme === "dark" ? colors.primary : "transparent",
            },
          ]}
          onPress={handleAddressSearch}
          disabled={loading}
        >
          <IconSymbol
            name="magnifyingglass"
            size={20}
            color={
              theme === "dark" ? colors.primary : colors.primaryForeground
            }
          />
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>
            Searching for ATMs...
          </ThemedText>
        </View>
      )}

      {/* Error */}
      {error && !loading && (
        <View
          style={[
            styles.errorContainer,
            {
              backgroundColor: colors.destructive + "20",
              borderColor: colors.destructive,
            },
          ]}
        >
          <ThemedText style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </ThemedText>
        </View>
      )}

      {/* Map and ATM List */}
      {!loading && !error && atms.length > 0 && (
        <View style={styles.contentContainer}>
          {/* Map View */}
          <View style={styles.mapContainer}>
            <GoogleMapsWebView
              userLocation={userLocation}
              atms={atms}
              selectedAtm={selectedAtm}
              onMarkerPress={(atm) => setSelectedAtm(atm)}
              theme={theme}
            />
          </View>

          {/* ATM List */}
          <View style={styles.listContainer}>
            <ThemedText type="subtitle" style={styles.listTitle}>
              Nearby ATMs ({atms.length})
            </ThemedText>
            <ScrollView
              ref={scrollViewRef}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            >
            {atms.map((atm) => (
              <TouchableOpacity
                key={atm.place_id}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  cardPositions.current[atm.place_id] = y;
                }}
                style={[
                  styles.atmCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedAtm?.place_id === atm.place_id && {
                    borderColor: colors.primary,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setSelectedAtm(atm)}
              >
                <View style={styles.atmCardHeader}>
                  <View style={styles.atmCardTitle}>
                    <IconSymbol
                      name="map.fill"
                      size={14}
                      color={colors.primary}
                    />
                    <ThemedText style={styles.atmName}>{atm.name}</ThemedText>
                  </View>
                  <ThemedText
                    style={[styles.atmDistance, { color: colors.primary }]}
                  >
                    {formatDistance(atm.distance)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.atmAddress}>
                  {atm.vicinity}
                </ThemedText>
                <View style={styles.atmCardFooter}>
                  {atm.rating && (
                    <View style={styles.ratingContainer}>
                      <ThemedText
                        style={[styles.rating, { color: colors.success }]}
                      >
                        ⭐ {atm.rating.toFixed(1)}
                      </ThemedText>
                      {atm.user_ratings_total && (
                        <ThemedText style={styles.ratingCount}>
                          ({atm.user_ratings_total})
                        </ThemedText>
                      )}
                    </View>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.mapIconButton,
                      {
                        backgroundColor: colors.accent + "20",
                      },
                    ]}
                    onPress={() => openInMaps(atm)}
                  >
                    <IconSymbol
                      name="arrow.up.right.square.fill"
                      size={16}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
            </ScrollView>
          </View>
        </View>
      )}

      {!loading && !error && atms.length === 0 && userLocation && (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            No ATMs found in this area
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { opacity: 0.6 }]}>
            Try searching for a different location
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    marginBottom: 0,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    minWidth: 0,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 44,
    fontSize: 16,
    minWidth: 0,
  },
  locationIconButton: {
    position: "absolute",
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    marginTop: 8,
  },
  errorContainer: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  contentContainer: {
    flex: 1,
    flexDirection: "column",
  },
  mapContainer: {
    height: 300,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  listContainer: {
    flex: 1,
    padding: 12,
  },
  listTitle: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  atmCard: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  atmCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  atmCardTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginRight: 8,
  },
  atmName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  atmDistance: {
    fontSize: 11,
    fontWeight: "600",
  },
  atmAddress: {
    fontSize: 11,
    marginBottom: 4,
    opacity: 0.7,
  },
  atmCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  rating: {
    fontSize: 11,
    fontWeight: "600",
  },
  ratingCount: {
    fontSize: 10,
    opacity: 0.6,
  },
  mapIconButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
});

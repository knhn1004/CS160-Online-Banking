import { useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";
import type { AtmLocation } from "@/lib/types";

interface GoogleMapsWebViewProps {
  userLocation: { lat: number; lng: number } | null;
  atms: AtmLocation[];
  selectedAtm: AtmLocation | null;
  onMarkerPress?: (atm: AtmLocation) => void;
  theme?: "light" | "dark";
}

export function GoogleMapsWebView({
  userLocation,
  atms,
  selectedAtm,
  onMarkerPress,
  theme = "light",
}: GoogleMapsWebViewProps) {
  const webViewRef = useRef<WebView>(null);

  const apiKey =
    Constants.expoConfig?.extra?.googleMapsApiKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";

  // Custom map styles based on theme
  const getMapStyles = useCallback(() => {
    if (theme === "dark") {
      return [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        {
          featureType: "administrative.locality",
          elementType: "labels.text.fill",
          stylers: [{ color: "#cbd5e1" }],
        },
        {
          featureType: "poi",
          elementType: "labels.text.fill",
          stylers: [{ color: "#cbd5e1" }],
        },
        {
          featureType: "poi.park",
          elementType: "geometry",
          stylers: [{ color: "#0f172a" }],
        },
        {
          featureType: "poi.park",
          elementType: "labels.text.fill",
          stylers: [{ color: "#14b8a6" }],
        },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#334155" }],
        },
        {
          featureType: "road",
          elementType: "geometry.stroke",
          stylers: [{ color: "#475569" }],
        },
        {
          featureType: "road",
          elementType: "labels.text.fill",
          stylers: [{ color: "#94a3b8" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry",
          stylers: [{ color: "#475569" }],
        },
        {
          featureType: "road.highway",
          elementType: "geometry.stroke",
          stylers: [{ color: "#64748b" }],
        },
        {
          featureType: "road.highway",
          elementType: "labels.text.fill",
          stylers: [{ color: "#cbd5e1" }],
        },
        {
          featureType: "transit",
          elementType: "geometry",
          stylers: [{ color: "#334155" }],
        },
        {
          featureType: "transit.station",
          elementType: "labels.text.fill",
          stylers: [{ color: "#cbd5e1" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#0f172a" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.fill",
          stylers: [{ color: "#64748b" }],
        },
        {
          featureType: "water",
          elementType: "labels.text.stroke",
          stylers: [{ color: "#1e293b" }],
        },
      ];
    } else {
      // Light theme - clean, minimal style
      return [
        {
          featureType: "all",
          elementType: "geometry.fill",
          stylers: [{ weight: "2.00" }],
        },
        {
          featureType: "all",
          elementType: "geometry.stroke",
          stylers: [{ color: "#e2e8f0" }],
        },
        {
          featureType: "all",
          elementType: "labels.text",
          stylers: [{ visibility: "on" }],
        },
        {
          featureType: "landscape",
          elementType: "all",
          stylers: [{ color: "#fefefe" }],
        },
        {
          featureType: "landscape.man_made",
          elementType: "geometry.fill",
          stylers: [{ color: "#ffffff" }],
        },
        {
          featureType: "landscape.natural.terrain",
          elementType: "geometry.fill",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "poi",
          elementType: "all",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "road",
          elementType: "all",
          stylers: [{ saturation: -100 }, { lightness: 45 }],
        },
        {
          featureType: "road",
          elementType: "geometry.fill",
          stylers: [{ color: "#f1f5f9" }],
        },
        {
          featureType: "road",
          elementType: "labels.text.fill",
          stylers: [{ color: "#64748b" }],
        },
        {
          featureType: "road.highway",
          elementType: "all",
          stylers: [{ visibility: "simplified" }],
        },
        {
          featureType: "road.arterial",
          elementType: "labels.icon",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "transit",
          elementType: "all",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "water",
          elementType: "geometry.fill",
          stylers: [{ color: "#e0e7ff" }],
        },
      ];
    }
  }, [theme]);

  // Effect to update map when location or ATMs change
  useEffect(() => {
    if (webViewRef.current && (userLocation || atms.length > 0)) {
      // Update map when location or ATMs change
      const center = userLocation || {
        lat: atms[0]?.geometry.location.lat || 37.7749,
        lng: atms[0]?.geometry.location.lng || -122.4194,
      };

      const markers = atms.map((atm) => ({
        lat: atm.geometry.location.lat,
        lng: atm.geometry.location.lng,
        name: atm.name,
        place_id: atm.place_id,
        distance: atm.distance,
      }));

      const script = `
        if (window.map) {
          window.map.setCenter({ lat: ${center.lat}, lng: ${center.lng} });
          window.map.setZoom(13);
          window.map.setOptions({ styles: ${JSON.stringify(getMapStyles())} });
          
          // Clear existing markers
          window.markers.forEach(marker => marker.setMap(null));
          window.markers = [];
          
          // Add new markers
          const markers = ${JSON.stringify(markers)};
          markers.forEach((atm, index) => {
            const marker = new google.maps.Marker({
              position: { lat: atm.lat, lng: atm.lng },
              map: window.map,
              title: atm.name,
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: new google.maps.Size(32, 32),
              },
            });
            
            
            window.markers.push(marker);
          });
        }
      `;

      webViewRef.current.injectJavaScript(script);
    }
  }, [userLocation, atms, theme, getMapStyles]);

  // Effect to focus map on selected ATM
  useEffect(() => {
    if (webViewRef.current && selectedAtm) {
      const { lat, lng } = selectedAtm.geometry.location;
      
      const script = `
        if (window.map) {
          window.map.panTo({ lat: ${lat}, lng: ${lng} });
          window.map.setZoom(16);
          
          // Find and highlight the selected marker
          if (window.markers) {
            window.markers.forEach((marker, index) => {
              const atm = ${JSON.stringify({
                lat: selectedAtm.geometry.location.lat,
                lng: selectedAtm.geometry.location.lng,
                place_id: selectedAtm.place_id,
              })};
              
              if (marker.position.lat() === atm.lat && marker.position.lng() === atm.lng) {
                // Change marker icon to highlight selected
                marker.setIcon({
                  url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                  scaledSize: new google.maps.Size(40, 40),
                });
                
                // Close any existing info windows
                if (window.infoWindow) {
                  window.infoWindow.close();
                  window.infoWindow = null;
                }
                
                // Don't show info window - the card list already shows all details
              } else {
                // Reset other markers to default
                marker.setIcon({
                  url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  scaledSize: new google.maps.Size(32, 32),
                });
              }
            });
          }
        }
      `;

      webViewRef.current.injectJavaScript(script);
    }
  }, [selectedAtm, theme]);

  if (!apiKey) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>
            Google Maps API key not configured. Please set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
            in your .env file.
          </Text>
        </View>
      </View>
    );
  }

  const center = userLocation || {
    lat: atms[0]?.geometry.location.lat || 37.7749,
    lng: atms[0]?.geometry.location.lng || -122.4194,
  };

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            height: 100%;
            width: 100%;
            overflow: hidden;
          }
          #map {
            height: 100%;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          let map;
          let markers = [];
          let infoWindow = null;
          
          function initMap() {
            map = new google.maps.Map(document.getElementById('map'), {
              center: { lat: ${center.lat}, lng: ${center.lng} },
              zoom: 13,
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              styles: ${JSON.stringify(getMapStyles())},
            });
            
            const initialMarkers = ${JSON.stringify(
              atms.map((atm) => ({
                lat: atm.geometry.location.lat,
                lng: atm.geometry.location.lng,
                name: atm.name,
                place_id: atm.place_id,
                distance: atm.distance,
              })),
            )};
            
            initialMarkers.forEach((atm) => {
              const marker = new google.maps.Marker({
                position: { lat: atm.lat, lng: atm.lng },
                map: map,
                title: atm.name,
                icon: {
                  url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  scaledSize: new google.maps.Size(32, 32),
                },
              });
              
              marker.addListener('click', () => {
                // Don't show info window - just trigger selection
                // The card list already shows all the details
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'marker_click',
                  place_id: atm.place_id,
                }));
              });
              
              markers.push(marker);
            });
            
            window.markers = markers;
            window.map = map;
            window.infoWindow = null;
          }
        </script>
        <script
          src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap"
          async
          defer
        ></script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "marker_click" && onMarkerPress) {
              const atm = atms.find((a) => a.place_id === data.place_id);
              if (atm) {
                onMarkerPress(atm);
              }
            }
          } catch (e) {
            console.error("Error parsing WebView message:", e);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("WebView error: ", nativeEvent);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorContent: {
    backgroundColor: "#ffebee",
    padding: 16,
    borderRadius: 8,
  },
  errorText: {
    color: "#c62828",
    fontSize: 14,
    textAlign: "center",
  },
});


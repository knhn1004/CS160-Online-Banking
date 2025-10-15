"use client";

import { useEffect, useRef, useState } from "react";

export default function ATMLocationsPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    // Prevent loading the script more than once
    const existingScript = document.getElementById("google-maps");
    if (existingScript) return;

    const script = document.createElement("script");
    script.id = "google-maps";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = initMap;
    document.body.appendChild(script);

    function initMap() {
      if (!mapRef.current) return;

      const defaultCenter = { lat: 37.3352, lng: -121.8811 }; //San Jose default location
      const gmap = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
      });
      setMap(gmap);

      // Autocomplete search
      if (inputRef.current) {
        const autocomplete = new google.maps.places.Autocomplete(
          inputRef.current,
          {
            types: ["geocode"],
          },
        );

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;

          gmap.setCenter(place.geometry.location);
          gmap.setZoom(14);

          // Search nearby ATMs
          const service = new google.maps.places.PlacesService(gmap);
          const request = {
            location: place.geometry.location,
            radius: 3000,
            keyword: "ATM",
          };

          service.nearbySearch(request, (results, status) => {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              results
            ) {
              // clear old markers before adding new ones!!! (might change later)
              markersRef.current.forEach((marker) => marker.setMap(null));
              markersRef.current = [];

              results.forEach((result) => {
                if (!result.geometry?.location) return;

                const marker = new google.maps.Marker({
                  map: gmap,
                  position: result.geometry.location,
                  title: result.name,
                  icon: {
                    url: "/bluemarker.png",
                    scaledSize: new google.maps.Size(36, 32),
                  },
                });

                markersRef.current.push(marker);
              });
            }
          });
        });
      }
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-20 bg-gradient-to-b from-blue-50 to-white">
        <h1 className="text-5xl font-extrabold mb-4 text-blue-700">
          ATM Locator
        </h1>
        <p className="text-lg text-gray-700 mb-8 max-w-2xl">
          Find nearby ATMs in seconds.
        </p>

        <div className="w-full max-w-md mb-6">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter address, city, or ZIP code"
            className="w-full border rounded-lg px-4 py-3 shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </section>

      {/* Map Section */}
      <section className="flex justify-center py-10 px-4 bg-white">
        <div
          ref={mapRef}
          className="w-full max-w-6xl h-[75vh] rounded-2xl border shadow-md"
        ></div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-100 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Bank160. All rights reserved.
      </footer>
    </main>
  );
}

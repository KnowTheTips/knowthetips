"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PlacePick = {
  placeId: string;
  name: string;
  formattedAddress: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

declare global {
  interface Window {
    google?: any;
  }
}

function loadScriptOnce(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(s);
  });
}

function getCityStateFromPlace(place: any): { city: string; state: string } {
  const comps = place.address_components || [];
  const city =
    comps.find((c: any) => c.types?.includes("locality"))?.long_name ||
    comps.find((c: any) => c.types?.includes("sublocality"))?.long_name ||
    comps.find((c: any) => c.types?.includes("administrative_area_level_2"))?.long_name ||
    "";

  const state = comps.find((c: any) => c.types?.includes("administrative_area_level_1"))?.short_name || "";
  return { city, state };
}

export default function PlacesAutocomplete(props: {
  placeholder?: string;
  onPick: (p: PlacePick) => void;
  defaultValue?: string;
  country?: string; // e.g. "us"
}) {
  const { placeholder = "Search a venue…", onPick, defaultValue = "", country = "us" } = props;

  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const apiKey = useMemo(() => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, []);
  const scriptSrc = useMemo(() => {
    const key = apiKey || "";
    return `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
  }, [apiKey]);

  useEffect(() => {
    let ac: any;

    async function init() {
      if (!apiKey) return; // no key, silently do nothing
      await loadScriptOnce(scriptSrc);

      if (!window.google || !inputRef.current) return;

      ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["place_id", "name", "formatted_address", "geometry", "address_components"],
        componentRestrictions: { country },
        types: ["establishment"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.place_id || !place?.geometry?.location) return;

        const { city, state } = getCityStateFromPlace(place);

        onPick({
          placeId: place.place_id,
          name: place.name || "",
          formattedAddress: place.formatted_address || "",
          city,
          state,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });

        setValue(place.name || "");
      });
    }

    init().catch(() => {});

    return () => {
      ac = null;
    };
  }, [apiKey, scriptSrc, onPick, country]);

  return (
    <input
      ref={inputRef}
      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
      placeholder={apiKey ? placeholder : "Google key missing — enter manually below"}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

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

function getCityStateFromPlace(place: any): { city: string; state: string } {
  const comps = place.address_components || [];
  const city =
    comps.find((c: any) => c.types?.includes("locality"))?.long_name ||
    comps.find((c: any) => c.types?.includes("sublocality"))?.long_name ||
    comps.find((c: any) => c.types?.includes("administrative_area_level_2"))
      ?.long_name ||
    "";

  const state =
    comps.find((c: any) => c.types?.includes("administrative_area_level_1"))
      ?.short_name || "";

  return { city, state };
}

function waitForGoogleMaps(ms = 8000) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();

    const tick = () => {
      if (window.google?.maps?.places) return resolve();
      if (Date.now() - start > ms) {
        return reject(new Error("Google Maps did not load in time."));
      }
      setTimeout(tick, 50);
    };

    tick();
  });
}

export default function PlacesAutocomplete(props: {
  placeholder?: string;
  onPick: (p: PlacePick) => void;
  defaultValue?: string;
  country?: string; // e.g. "us"
}) {
  const {
    placeholder = "Search a venue…",
    onPick,
    defaultValue = "",
    country = "us",
  } = props;

  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep input synced if parent ever changes defaultValue (safe, tiny improvement)
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  // IMPORTANT: avoid re-initializing Autocomplete when parent re-renders.
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const apiKeyExists = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  useEffect(() => {
    let ac: any = null;
    let canceled = false;

    async function init() {
      if (!apiKeyExists) return; // no key, silently do nothing
      if (!inputRef.current) return;

      try {
        await waitForGoogleMaps();
      } catch {
        return;
      }

      if (canceled) return;
      if (!window.google?.maps?.places) return;

      ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: [
          "place_id",
          "name",
          "formatted_address",
          "geometry",
          "address_components",
        ],
        componentRestrictions: { country },
        types: ["establishment"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.place_id || !place?.geometry?.location) return;

        const { city, state } = getCityStateFromPlace(place);

        onPickRef.current({
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

    init();

    return () => {
      canceled = true;
      ac = null;
    };
  }, [apiKeyExists, country]);

  return (
    <input
      ref={inputRef}
      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
      placeholder={
        apiKeyExists ? placeholder : "Google key missing — enter manually below"
      }
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

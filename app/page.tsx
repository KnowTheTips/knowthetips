"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// IMPORTANT:
// Change this import to match your actual file name:
// - If your file is app/components/PlacesAutocomplete.tsx, keep this as-is.
// - If your file is app/components/Autocomplete.tsx, change it to:  import PlacesAutocomplete from "@/app/components/Autocomplete";
import PlacesAutocomplete from "@/app/components/PlacesAutocomplete";

type Venue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venue_type: string | null;
  created_at: string;
};

type VenueWithCount = Venue & { review_count: number };

// Matches what your Places component returns
type PlacePick = {
  placeId: string;
  name: string;
  formattedAddress: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

export default function Home() {
  // Venues list (+ review counts)
  const [venues, setVenues] = useState<VenueWithCount[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  // Add venue form
  const [venueName, setVenueName] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venueType, setVenueType] = useState("");

  // Optional Places pick
  const [placePick, setPlacePick] = useState<PlacePick | null>(null);

  // ---------- Load Venues (and counts) ----------
  async function loadVenues() {
    setVenuesLoading(true);
    setVenuesError(null);

    // 1) Load venues
    const { data: venuesData, error: venuesErr } = await supabase
      .from("venues")
      .select("id,name,city,state,venue_type,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (venuesErr) {
      setVenuesError(venuesErr.message);
      setVenues([]);
      setVenuesLoading(false);
      return;
    }

    const baseVenues = (venuesData || []) as Venue[];
    if (baseVenues.length === 0) {
      setVenues([]);
      setVenuesLoading(false);
      return;
    }

    // 2) Get review counts (fetch reviews for these venues, count in JS)
    const venueIds = baseVenues.map((v) => v.id).filter(Boolean);

    const { data: reviewsData, error: reviewsErr } = await supabase
      .from("reviews")
      .select("venue_id")
      .in("venue_id", venueIds);

    if (reviewsErr) {
      // If counts fail, still show venues
      setVenues(
        baseVenues.map((v) => ({
          ...v,
          review_count: 0,
        }))
      );
      setVenuesLoading(false);
      return;
    }

    const counts = new Map<string, number>();
    for (const r of reviewsData || []) {
      const vid = (r as any).venue_id as string;
      if (!vid) continue;
      counts.set(vid, (counts.get(vid) || 0) + 1);
    }

    setVenues(
      baseVenues.map((v) => ({
        ...v,
        review_count: counts.get(v.id) || 0,
      }))
    );

    setVenuesLoading(false);
  }

  useEffect(() => {
    loadVenues();
  }, []);

  // ---------- Add Venue ----------
  async function addVenue(e: React.FormEvent) {
    e.preventDefault();

    const name = venueName.trim();
    const city = venueCity.trim();
    const type = venueType.trim();

    if (!name || !city) {
      alert("Venue name and city are required.");
      return;
    }

    const insertPayload: any = {
      name,
      city,
      state: "NJ",
      venue_type: type || null,
    };

    // If chosen via Places, store optional fields (only if your DB has columns for them)
    if (placePick?.placeId) {
      insertPayload.place_id = placePick.placeId;
      insertPayload.formatted_address = placePick.formattedAddress || null;
      insertPayload.lat = Number.isFinite(placePick.lat) ? placePick.lat : null;
      insertPayload.lng = Number.isFinite(placePick.lng) ? placePick.lng : null;
    }

    const { error } = await supabase.from("venues").insert(insertPayload);

    if (error) {
      alert("Error adding venue: " + error.message);
      return;
    }

    setVenueName("");
    setVenueCity("");
    setVenueType("");
    setPlacePick(null);

    await loadVenues();
  }

  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Top header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">KnowTheTips</h1>
            <p className="mt-2 text-neutral-600">
              Anonymous venue insights for bartenders and servers.
            </p>
          </div>
        </div>

        {/* Add a venue */}
        <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-xl font-semibold">Add a venue</h2>

          {/* Google Places search (restored) */}
          <div className="mt-4 grid gap-2">
            <div className="text-sm font-medium">Search with Google (autocomplete)</div>

            <PlacesAutocomplete
              placeholder="Start typing a venue name…"
              onPick={(p) => {
                setPlacePick(p);
                setVenueName(p.name || "");
                setVenueCity(p.city || "");
              }}
              country="us"
            />

            {placePick ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
                <div className="font-medium">Selected:</div>
                <div className="mt-1">{placePick.formattedAddress || "Address unavailable"}</div>
                <div className="mt-1 text-xs text-neutral-600">
                  place_id saved for de-duplication
                </div>
              </div>
            ) : (
              <div className="text-xs text-neutral-500">
                {googleEnabled
                  ? "Pick a result to auto-fill name/city."
                  : "Google key not detected — use manual entry below."}
              </div>
            )}
          </div>

          {/* Manual entry (still available) */}
          <form onSubmit={addVenue} className="mt-4 grid gap-3">
            <input
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
              placeholder="Venue name (required)"
              value={venueName}
              onChange={(e) => {
                setVenueName(e.target.value);
                // If user edits away from the selected place, stop using placePick
                if (placePick && e.target.value.trim() !== placePick.name.trim()) {
                  setPlacePick(null);
                }
              }}
            />
            <input
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
              placeholder="City (required)"
              value={venueCity}
              onChange={(e) => {
                setVenueCity(e.target.value);
                if (placePick && e.target.value.trim() !== placePick.city.trim()) {
                  setPlacePick(null);
                }
              }}
            />
            <input
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
              placeholder="Venue type (optional) — bar, restaurant, etc"
              value={venueType}
              onChange={(e) => setVenueType(e.target.value)}
            />

            <button className="mt-2 w-full rounded-xl bg-black px-4 py-3 font-medium text-white hover:bg-neutral-800">
              Add venue
            </button>
          </form>
        </section>

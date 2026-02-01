"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Venue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venue_type: string | null;
  created_at: string;
};

type VenueWithCount = Venue & { review_count: number };

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function titleCase(s: string) {
  const cleaned = normalizeSpaces(s).toLowerCase();
  return cleaned.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export default function Home() {
  // Venues list (+ review counts)
  const [venues, setVenues] = useState<VenueWithCount[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  // Add venue form (manual fallback)
  const [venueName, setVenueName] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venueType, setVenueType] = useState("");
  const [venueState, setVenueState] = useState("NJ");

  // Google Places Autocomplete (inline)
  const inputRef = useRef<HTMLInputElement | null>(null);
  const acRef = useRef<any>(null);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

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
    const venueIds = baseVenues.map((v) => v.id);

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

  // ---------- Google Places wiring (no external component import) ----------
  useEffect(() => {
    let tries = 0;
    const maxTries = 80; // ~8s

    function init() {
      try {
        const w = window as any;
        if (!w.google || !w.google.maps || !w.google.maps.places) return false;
        if (!inputRef.current) return false;

        // Prevent double-init
        if (acRef.current) return true;

        acRef.current = new w.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["name", "address_components", "types"],
          types: ["establishment"],
        });

        acRef.current.addListener("place_changed", () => {
          const place = acRef.current?.getPlace?.();
          if (!place) return;

          const name = place.name ? String(place.name) : "";

          const comps: any[] = Array.isArray(place.address_components)
            ? place.address_components
            : [];

          const cityComp =
            comps.find((c) => c?.types?.includes("locality")) ||
            comps.find((c) => c?.types?.includes("postal_town")) ||
            comps.find((c) => c?.types?.includes("sublocality")) ||
            comps.find((c) => c?.types?.includes("administrative_area_level_2"));

          const stateComp = comps.find((c) =>
            c?.types?.includes("administrative_area_level_1")
          );

          const nextCity = cityComp?.long_name ? String(cityComp.long_name) : "";
          const nextState = stateComp?.short_name
            ? String(stateComp.short_name)
            : "";

          // Prefill manual fields (still user-confirmable)
          if (name) setVenueName(name);
          if (nextCity) setVenueCity(titleCase(nextCity));
          if (nextState) setVenueState(nextState.toUpperCase());
        });

        setPlacesReady(true);
        setPlacesError(null);
        return true;
      } catch (e: any) {
        setPlacesError(e?.message || "Failed to initialize Google Places.");
        return true; // stop retrying if it throws
      }
    }

    const timer = window.setInterval(() => {
      tries += 1;
      const ok = init();
      if (ok || tries >= maxTries) {
        window.clearInterval(timer);
        if (!ok && tries >= maxTries) {
          setPlacesReady(false);
          setPlacesError(
            "Google Places did not load. Manual add still works."
          );
        }
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  // ---------- Add Venue (manual submit) ----------
  async function addVenue(e: React.FormEvent) {
    e.preventDefault();

    const name = normalizeSpaces(venueName);
    const city = normalizeSpaces(venueCity);
    const type = normalizeSpaces(venueType);
    const st = normalizeSpaces(venueState);

    if (!name || !city) {
      alert("Venue name and city are required.");
      return;
    }

    const { error } = await supabase.from("venues").insert({
      name,
      city: titleCase(city),
      state: (st || "NJ").toUpperCase(),
      venue_type: type || null,
    });

    if (error) {
      alert("Error adding venue: " + error.message);
      return;
    }

    // Clear fields
    setVenueName("");
    setVenueCity("");
    setVenueType("");
    setVenueState("NJ");

    // Clear the Google input box text (if present)
    if (inputRef.current) inputRef.current.value = "";

    await loadVenues();
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight">KnowTheTips</h1>
        <p className="mt-2 text-neutral-600">
          Venues pulled from Supabase + add new ones (no login).
        </p>

        {/* Add a venue */}
        <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-xl font-semibold">Add a venue</h2>

          {/* Google Places Autocomplete (visible on home screen) */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700">
              Search with Google (autocomplete)
            </label>
            <input
              ref={inputRef}
              className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
              placeholder="Start typing a venue name…"
              autoComplete="off"
            />
            <div className="mt-2 text-xs text-neutral-500">
              {placesError
                ? placesError
                : placesReady
                ? "Select a place to autofill the form below."
                : "Loading Google Places…"}
            </div>
          </div>

          {/* Manual form (still the source of truth) */}
          <form onSubmit={addVenue} className="mt-6 grid gap-3">
            <input
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
              placeholder="Venue name (required)"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300 md:col-span-2"
                placeholder="City (required)"
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="State"
                value={venueState}
                onChange={(e) => setVenueState(e.target.value)}
              />
            </div>

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

        {/* Venues */}
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold">Venues</h2>
            <button
              onClick={loadVenues}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Refresh
            </button>
          </div>

          {venuesLoading && (
            <p className="mt-4 text-neutral-600">Loading venues…</p>
          )}
          {venuesError && (
            <p className="mt-4 text-red-600">Error: {venuesError}</p>
          )}

          <div className="mt-4 grid gap-3">
            {venues.map((v) => (
              <Link
                key={v.id}
                href={`/venues/${v.id}`}
                className="block rounded-2xl border border-neutral-200 p-5 transition hover:bg-neutral-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{v.name}</div>
                    <div className="text-sm text-neutral-600">
                      {v.city}, {v.state}
                      {v.venue_type ? ` • ${v.venue_type}` : ""}
                    </div>

                    <div className="mt-1 text-sm text-neutral-500">
                      {v.review_count} review{v.review_count === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500">
                    {new Date(v.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

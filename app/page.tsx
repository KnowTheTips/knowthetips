"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
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

type PlacePick = {
  placeId: string;
  name: string;
  formattedAddress: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

type SortMode = "NEWEST" | "OLDEST" | "MOST_REVIEWS";

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

  // Add venue form
  const [venueName, setVenueName] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venueType, setVenueType] = useState("");

  // Google Places pick
  const [placePick, setPlacePick] = useState<PlacePick | null>(null);

  // Browse controls
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [sort, setSort] = useState<SortMode>("NEWEST");

  async function loadVenues() {
    setVenuesLoading(true);
    setVenuesError(null);

    const { data: venuesData, error: venuesErr } = await supabase
      .from("venues")
      .select("id,name,city,state,venue_type,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

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

    const venueIds = baseVenues.map((v) => v.id).filter(Boolean);

    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("venue_id")
      .in("venue_id", venueIds);

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

    if (placePick?.placeId) {
      insertPayload.place_id = placePick.placeId;
      insertPayload.formatted_address = placePick.formattedAddress || null;
      insertPayload.lat = placePick.lat;
      insertPayload.lng = placePick.lng;
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

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of venues) {
      if (v.city) set.add(titleCase(v.city));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [venues]);

  const filteredVenues = useMemo(() => {
    const q = normalizeSpaces(search).toLowerCase();

    let list = venues.slice();

    if (cityFilter !== "ALL") {
      list = list.filter((v) => titleCase(v.city) === cityFilter);
    }

    if (q) {
      list = list.filter((v) => {
        const hay = `${v.name} ${v.city} ${v.state} ${v.venue_type ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();

      if (sort === "NEWEST") return db - da;
      if (sort === "OLDEST") return da - db;
      if (sort === "MOST_REVIEWS") return (b.review_count ?? 0) - (a.review_count ?? 0);

      return 0;
    });

    return list;
  }, [venues, search, cityFilter, sort]);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* HERO (no fake stats card) */}
        <section className="pt-2">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700">
              <span className="font-medium">Real reviews for bartenders & servers</span>
              <span className="text-neutral-300">•</span>
              <span>Tips</span>
              <span className="text-neutral-300">•</span>
              <span>Hours</span>
              <span className="text-neutral-300">•</span>
              <span>Expectations</span>
            </div>

            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Know the tips{" "}
              <span className="text-neutral-400">before</span>{" "}
              you take the job.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-neutral-700 md:text-xl">
              Search a bar or restaurant and see what staff actually report: average tips,
              seasonality, tip pool setup, and whether they’d recommend the gig.
            </p>

            <p className="mt-4 text-sm text-neutral-500">
              Tip reporting note: entries may be labeled as pre-tax or post-tax.
            </p>
          </div>
        </section>

        {/* TWO PRIMARY CARDS */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* ADD A VENUE (first in DOM so it appears first on mobile) */}
          <section id="add-venue" className="rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-2xl font-semibold">Add a venue</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Use Google autocomplete to reduce typos (manual entry still works).
            </p>

            <div className="mt-5 grid gap-2">
              <div className="text-sm font-medium">Search with Google</div>

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
                  <div className="mt-1">
                    {placePick.formattedAddress || "Address unavailable"}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">
                  {googleEnabled
                    ? "Pick a result to auto-fill the form below."
                    : "Google key not detected — use manual entry below."}
                </div>
              )}
            </div>

            <form onSubmit={addVenue} className="mt-5 grid gap-3">
              <input
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="Venue name (required)"
                value={venueName}
                onChange={(e) => {
                  setVenueName(e.target.value);
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

          {/* BROWSE */}
          <section id="browse" className="rounded-2xl border border-neutral-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Browse venues</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Search and filter what’s already in the database.
                </p>
              </div>

              <button
                onClick={loadVenues}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
              >
                Refresh
              </button>
            </div>

            <input
              className="mt-5 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
              placeholder="Search name, city, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium">City</span>
                <select
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                >
                  <option value="ALL">All</option>
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Sort</span>
                <select
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                >
                  <option value="NEWEST">Newest</option>
                  <option value="OLDEST">Oldest</option>
                  <option value="MOST_REVIEWS">Most reviews</option>
                </select>
              </label>
            </div>

            <p className="mt-3 text-sm text-neutral-600">
              Showing <span className="font-medium">{filteredVenues.length}</span> of{" "}
              <span className="font-medium">{venues.length}</span>
            </p>

            <div className="mt-4 grid gap-3">
              {venuesLoading ? (
                <p className="text-neutral-600">Loading venues…</p>
              ) : venuesError ? (
                <p className="text-red-600">Error: {venuesError}</p>
              ) : filteredVenues.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700">
                  No venues match your filters yet.
                </div>
              ) : (
                filteredVenues.map((v) => (
                  <Link
                    key={v.id}
                    href={`/venues/${v.id}`}
                    className="block rounded-2xl border border-neutral-200 p-5 transition hover:bg-neutral-50"
                  >
                    <div className="flex justify-between gap-4">
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
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PlacesAutocomplete from "@/app/components/PlacesAutocomplete";

type VenueRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  venue_type: string | null;
  created_at: string;

  // Optional Google Places fields (may be null for older rows)
  place_id?: string | null;
  formatted_address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type VenueMetricsRow = {
  venue_id: string;
  review_count: number | null;
  avg_tips_weekly: number | null;
  avg_hours_weekly: number | null;
  pct_recommended: number | null;
  pct_tip_pool: number | null;
};

type Venue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venue_type: string | null;
  created_at: string;

  // Optional Google Places fields
  place_id?: string | null;
  formatted_address?: string | null;
  lat?: number | null;
  lng?: number | null;

  // Metrics (merged from RPC)
  review_count: number;
  avg_tips_weekly: number | null;
  avg_hours_weekly: number | null;
  pct_recommended: number | null;
  pct_tip_pool: number | null;
};

type PlacePick = {
  placeId: string;
  name: string;
  formattedAddress: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function titleCase(s: string) {
  const cleaned = normalizeSpaces(s).toLowerCase();
  return cleaned.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function normalizeCityForStorage(city: string) {
  return titleCase(city);
}

function normalizeTypeForStorage(type: string) {
  const t = normalizeSpaces(type);
  return t ? titleCase(t) : "";
}

function normKey(s: string) {
  return normalizeSpaces(s).toLowerCase();
}

// --- Typo protection helpers (no libraries) ---
function levenshtein(a: string, b: string) {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function bestCitySuggestion(input: string, options: string[]) {
  const raw = normalizeSpaces(input);
  if (!raw) return null;

  const inputTC = titleCase(raw);
  const exact = options.find((c) => c.toLowerCase() === inputTC.toLowerCase());
  if (exact) return null;

  let best: { city: string; dist: number } | null = null;

  for (const city of options) {
    const dist = levenshtein(inputTC, city);
    if (!best || dist < best.dist) best = { city, dist };
  }

  if (!best) return null;

  const len = inputTC.length;
  if (len < 5) return null;

  const dist = best.dist;
  if (dist <= 2) return best.city;
  if (dist === 3 && len >= 9) return best.city;

  return null;
}

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

type SortMode =
  | "NEWEST"
  | "OLDEST"
  | "MOST_REVIEWS"
  | "AVG_TIPS"
  | "PCT_RECOMMENDED"
  | "AVG_HOURS";

type TopMetric = "AVG_TIPS" | "PCT_RECOMMENDED" | "MOST_REVIEWS";

export default function Home() {
  const router = useRouter();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Browse controls
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sort, setSort] = useState<SortMode>("NEWEST");

  // Top venues controls
  const [topCity, setTopCity] = useState<string>("ALL");
  const [topMetric, setTopMetric] = useState<TopMetric>("AVG_TIPS");

  // Add venue form
  const [venueName, setVenueName] = useState("");
  const [venueCity, setVenueCity] = useState<string>("");
  const [venueType, setVenueType] = useState("");
  const [venueState, setVenueState] = useState<string>("NJ");

  // Google Places pick (optional)
  const [placePick, setPlacePick] = useState<PlacePick | null>(null);

  // Duplicate UX
  const [dupFound, setDupFound] = useState<VenueRow | null>(null);
  const [dupNote, setDupNote] = useState<string | null>(null);

  async function loadVenuesAndMetrics() {
    setLoading(true);
    setError(null);

    // 1) Load venues
    const venuesRes = await supabase
      .from("venues")
      .select(
        "id,name,city,state,venue_type,created_at,place_id,formatted_address,lat,lng"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (venuesRes.error) {
      setError(venuesRes.error.message);
      setVenues([]);
      setLoading(false);
      return;
    }

    const venueRows = (venuesRes.data || []) as VenueRow[];

    // 2) Load metrics via RPC (if not created yet, we fall back gracefully)
    const metricsRes = await supabase.rpc("get_venue_metrics");

    const metricsMap = new Map<string, VenueMetricsRow>();
    if (!metricsRes.error) {
      const rows = (metricsRes.data || []) as VenueMetricsRow[];
      for (const r of rows) metricsMap.set(r.venue_id, r);
    }

    // 3) Merge
    const merged: Venue[] = venueRows.map((v) => {
      const m = metricsMap.get(v.id);
      return {
        ...v,
        review_count: m?.review_count ?? 0,
        avg_tips_weekly: m?.avg_tips_weekly ?? null,
        avg_hours_weekly: m?.avg_hours_weekly ?? null,
        pct_recommended: m?.pct_recommended ?? null,
        pct_tip_pool: m?.pct_tip_pool ?? null,
      };
    });

    // If RPC failed, show a helpful note but keep site usable
    if (metricsRes.error) {
      setError(
        `Venues loaded, but metrics not loaded yet. (Did you run the Supabase SQL step?)\n\nDetails: ${metricsRes.error.message}`
      );
    }

    setVenues(merged);
    setLoading(false);
  }

  useEffect(() => {
    loadVenuesAndMetrics();
  }, []);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of venues) {
      if (v.city) set.add(titleCase(v.city));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [venues]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of venues) {
      if (v.venue_type) set.add(titleCase(v.venue_type));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [venues]);

  // Default topCity once we have cities
  useEffect(() => {
    if (topCity === "ALL" && cityOptions.length > 0) {
      setTopCity(cityOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityOptions.length]);

  const citySuggestion = useMemo(
    () => bestCitySuggestion(venueCity, cityOptions),
    [venueCity, cityOptions]
  );

  const filteredVenues = useMemo(() => {
    const q = normalizeSpaces(search).toLowerCase();
    let list = venues.slice();

    if (cityFilter !== "ALL") {
      list = list.filter((v) => titleCase(v.city) === cityFilter);
    }
    if (typeFilter !== "ALL") {
      list = list.filter(
        (v) => (v.venue_type ? titleCase(v.venue_type) : "") === typeFilter
      );
    }
    if (q) {
      list = list.filter((v) => {
        const hay = `${v.name} ${v.city} ${v.state} ${
          v.venue_type ?? ""
        }`.toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();

      if (sort === "NEWEST") return db - da;
      if (sort === "OLDEST") return da - db;

      if (sort === "MOST_REVIEWS")
        return (b.review_count ?? 0) - (a.review_count ?? 0);

      if (sort === "AVG_TIPS") {
        const av =
          typeof a.avg_tips_weekly === "number" ? a.avg_tips_weekly : -Infinity;
        const bv =
          typeof b.avg_tips_weekly === "number" ? b.avg_tips_weekly : -Infinity;
        return bv - av;
      }

      if (sort === "AVG_HOURS") {
        const av =
          typeof a.avg_hours_weekly === "number"
            ? a.avg_hours_weekly
            : -Infinity;
        const bv =
          typeof b.avg_hours_weekly === "number"
            ? b.avg_hours_weekly
            : -Infinity;
        return bv - av;
      }

      if (sort === "PCT_RECOMMENDED") {
        const av =
          typeof a.pct_recommended === "number" ? a.pct_recommended : -Infinity;
        const bv =
          typeof b.pct_recommended === "number" ? b.pct_recommended : -Infinity;
        return bv - av;
      }

      return 0;
    });

    return list;
  }, [venues, search, cityFilter, typeFilter, sort]);

  const topVenuesForCity = useMemo(() => {
    if (!topCity || topCity === "ALL") return [];

    const inCity = venues.filter((v) => titleCase(v.city) === topCity);

    const score = (v: Venue) => {
      if (topMetric === "MOST_REVIEWS") return v.review_count ?? 0;
      if (topMetric === "AVG_TIPS")
        return typeof v.avg_tips_weekly === "number"
          ? v.avg_tips_weekly
          : -Infinity;
      // PCT_RECOMMENDED
      return typeof v.pct_recommended === "number"
        ? v.pct_recommended
        : -Infinity;
    };

    const sorted = inCity.slice().sort((a, b) => score(b) - score(a));
    return sorted.slice(0, 5);
  }, [venues, topCity, topMetric]);

  async function findExistingVenue(
    normalizedName: string,
    normalizedCity: string,
    state: string
  ) {
    const { data, error } = await supabase
      .from("venues")
      .select("id,name,city,state,venue_type,created_at,place_id,formatted_address,lat,lng")
      .eq("state", state)
      .limit(100);

    if (error) return null;

    const match = (data || []).find((v: any) => {
      return (
        normKey(v.name) === normalizedName &&
        normKey(v.city) === normalizedCity &&
        normKey(v.state) === normKey(state)
      );
    });

    return (match ?? null) as VenueRow | null;
  }

  async function findExistingVenueByPlaceId(placeId: string) {
    const { data, error } = await supabase
      .from("venues")
      .select("id,name,city,state,venue_type,created_at,place_id,formatted_address,lat,lng")
      .eq("place_id", placeId)
      .maybeSingle();

    if (error) return null;
    return (data ?? null) as VenueRow | null;
  }

  function clearDuplicateBanner() {
    setDupFound(null);
    setDupNote(null);
  }

  function setManualName(v: string) {
    setVenueName(v);
    // If user edits after picking a Place, keep the pick only if it still matches (lightweight rule)
    if (placePick && normalizeSpaces(v) !== normalizeSpaces(placePick.name)) {
      setPlacePick(null);
    }
  }

  function setManualCity(v: string) {
    setVenueCity(v);
    if (placePick && titleCase(v) !== titleCase(placePick.city)) {
      setPlacePick(null);
    }
  }

  async function addVenue(e: React.FormEvent) {
    e.preventDefault();

    clearDuplicateBanner();

    const name = normalizeSpaces(venueName);
    const cityRaw = normalizeSpaces(venueCity);
    const typeRaw = normalizeSpaces(venueType);

    if (!name) return alert("Venue name is required.");
    if (!cityRaw) return alert("City is required.");

    // If user didn't use Places (or edited away from it), we keep your existing typo protection
    const suggestion = bestCitySuggestion(cityRaw, cityOptions);
    let finalCityRaw = cityRaw;

    if (!placePick && suggestion) {
      const ok = window.confirm(
        `Did you mean "${suggestion}"?\n\nOK = use suggestion\nCancel = keep "${titleCase(cityRaw)}"`
      );
      if (ok) finalCityRaw = suggestion;
    }

    const city = normalizeCityForStorage(finalCityRaw);
    const venue_type = typeRaw ? normalizeTypeForStorage(typeRaw) : null;

    // If we have a PlacePick, prefer its normalized city/state and store place fields
    const finalState = placePick?.state?.trim() ? placePick.state.trim() : venueState || "NJ";
    const insertPayload: any = {
      name,
      city: placePick?.city ? normalizeCityForStorage(placePick.city) : city,
      state: finalState,
      venue_type,
    };

    if (placePick?.placeId) {
      insertPayload.place_id = placePick.placeId;
      insertPayload.formatted_address = placePick.formattedAddress || null;
      insertPayload.lat = Number.isFinite(placePick.lat) ? placePick.lat : null;
      insertPayload.lng = Number.isFinite(placePick.lng) ? placePick.lng : null;
    }

    const { error } = await supabase.from("venues").insert(insertPayload);

    if (error) {
      const msg = (error as any)?.message || "Unknown error";
      const code = (error as any)?.code;

      // Postgres unique violation is typically code 23505
      if (code === "23505" || msg.toLowerCase().includes("duplicate")) {
        // Try to find the existing venue (prefer place_id if present)
        let existing: VenueRow | null = null;

        if (placePick?.placeId) {
          existing = await findExistingVenueByPlaceId(placePick.placeId);
        }
        if (!existing) {
          existing = await findExistingVenue(normKey(name), normKey(city), finalState);
        }

        alert(
          `Looks like "${name}" already exists in ${city}, ${finalState}.\n\nTry searching it above and click the existing venue instead.`
        );

        if (existing) {
          setDupFound(existing);
          setDupNote("We found the existing venue. Click to open it.");
        } else {
          setDupNote(
            "Duplicate detected, but we couldn’t auto-locate it. Try searching above."
          );
        }
        return;
      }

      alert("Error adding venue: " + msg);
      return;
    }

    setVenueName("");
    setVenueCity("");
    setVenueType("");
    setVenueState("NJ");
    setPlacePick(null);

    await loadVenuesAndMetrics();
  }

  function clearBrowse() {
    setSearch("");
    setCityFilter("ALL");
    setTypeFilter("ALL");
    setSort("NEWEST");
  }

  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight">KnowTheTips</h1>
        <p className="mt-2 text-neutral-600">
          Venues + reviews. Now with venue rankings (avg tips / % recommended).
        </p>

        {/* Add venue */}
        <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-xl font-semibold">Add a venue</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Use Google search to prevent typos — you can still enter manually if needed.
          </p>

          {(dupFound || dupNote) && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">Duplicate venue detected</div>
                  <div className="mt-1 text-sm text-blue-800">
                    {dupNote ?? "This venue already exists."}
                  </div>

                  {dupFound && (
                    <div className="mt-3 rounded-xl border border-blue-200 bg-white p-4">
                      <div className="font-semibold">{dupFound.name}</div>
                      <div className="text-sm text-neutral-700">
                        {titleCase(dupFound.city)}, {dupFound.state}
                        {dupFound.venue_type
                          ? ` • ${titleCase(dupFound.venue_type)}`
                          : ""}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {dupFound && (
                    <button
                      type="button"
                      onClick={() => router.push(`/venues/${dupFound.id}`)}
                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                      Go to venue
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearDuplicateBanner}
                    className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm hover:bg-blue-100"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={addVenue}
            className="mt-4 grid gap-3"
          >
            {/* Google Places search */}
            <div className="grid gap-2">
              <div className="text-sm font-medium">Search with Google</div>
              <PlacesAutocomplete
                placeholder="Start typing a venue name…"
                onPick={(p) => {
                  clearDuplicateBanner();

                  setPlacePick(p);

                  // Fill fields
                  setVenueName(p.name || "");
                  setVenueCity(titleCase(p.city || ""));
                  setVenueState((p.state || "NJ").toUpperCase());

                  // If you want to keep venue_type purely manual (recommended), don't auto-fill it.
                  // setVenueType("");

                  // Helpful note
                  setDupNote(null);
                  setDupFound(null);
                }}
                country="us"
              />

              {placePick ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
                  <div className="font-medium">Selected:</div>
                  <div className="mt-1">
                    {placePick.formattedAddress || "Address unavailable"}
                  </div>
                  <div className="mt-1 text-xs text-neutral-600">
                    place_id saved for de-duplication
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">
                  {googleEnabled
                    ? "Pick a result to auto-fill name/city and store place_id."
                    : "Google key not detected — this box will not autocomplete yet."}
                </div>
              )}
            </div>

            {/* Manual fields (still editable) */}
            <input
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
              placeholder="Venue name (required)"
              value={venueName}
              onChange={(e) => setManualName(e.target.value)}
            />

            <div className="grid gap-2">
              <input
                list="city-options"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="City (required) — type to see suggestions"
                value={venueCity}
                onChange={(e) => setManualCity(e.target.value)}
              />
              <datalist id="city-options">
                {cityOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              {/* Only show typo suggestions when not using Places */}
              {!placePick ? (
                citySuggestion ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Did you mean{" "}
                    <span className="font-semibold">“{citySuggestion}”</span>?
                    <button
                      type="button"
                      onClick={() => setVenueCity(citySuggestion)}
                      className="ml-3 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs hover:bg-amber-100"
                    >
                      Use suggestion
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    If it’s not listed, type it anyway — we’ll store it in consistent casing.
                  </p>
                )
              ) : (
                <p className="text-xs text-neutral-500">
                  City came from Google. If you change it, we’ll stop using the selected place_id.
                </p>
              )}
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

        {/* NEW: Top venues per city */}
        <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Top venues</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Quick leaderboard per city based on tips/recommended/reviews.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">City</span>
              <select
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                value={topCity}
                onChange={(e) => setTopCity(e.target.value)}
              >
                <option value="ALL">Pick a city…</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Rank by</span>
              <select
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                value={topMetric}
                onChange={(e) => setTopMetric(e.target.value as TopMetric)}
              >
                <option value="AVG_TIPS">Highest avg tips</option>
                <option value="PCT_RECOMMENDED">Highest % recommended</option>
                <option value="MOST_REVIEWS">Most reviews</option>
              </select>
            </label>
          </div>

          {topCity === "ALL" ? (
            <p className="mt-4 text-sm text-neutral-600">
              Pick a city to see the leaderboard.
            </p>
          ) : topVenuesForCity.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">
              No venues found for {topCity}.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {topVenuesForCity.map((v, idx) => {
                const metricLabel =
                  topMetric === "MOST_REVIEWS"
                    ? `${v.review_count} ${
                        v.review_count === 1 ? "review" : "reviews"
                      }`
                    : topMetric === "AVG_TIPS"
                    ? v.avg_tips_weekly == null
                      ? "Avg tips: —"
                      : `Avg tips: ${fmtMoney(v.avg_tips_weekly)}`
                    : v.pct_recommended == null
                    ? "Recommended: —"
                    : `Recommended: ${fmtPct(v.pct_recommended)}`;

                return (
                  <button
                    key={v.id}
                    onClick={() => router.push(`/venues/${v.id}`)}
                    className="text-left rounded-2xl border border-neutral-200 p-5 transition hover:bg-neutral-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700">
                            #{idx + 1}
                          </span>
                          <div className="text-lg font-semibold">{v.name}</div>
                        </div>

                        <div className="mt-1 text-sm text-neutral-600">
                          {titleCase(v.city)}, {v.state}
                          {v.venue_type ? ` • ${titleCase(v.venue_type)}` : ""}
                        </div>

                        <div className="mt-2 text-sm text-neutral-800">
                          {metricLabel}
                        </div>
                      </div>

                      <div className="text-xs text-neutral-500">
                        {new Date(v.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Browse */}
        <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Browse</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Search + filter + rank venues by tips/recommended.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadVenuesAndMetrics}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
              >
                Refresh
              </button>
              <button
                onClick={clearBrowse}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
              >
                Clear
              </button>
            </div>
          </div>

          <input
            className="mt-4 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
            placeholder="Search name, city, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="mt-4 grid gap-3 md:grid-cols-3">
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
              <span className="text-sm font-medium">Venue type</span>
              <select
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Rank venues by</span>
              <select
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
              >
                <option value="NEWEST">Newest</option>
                <option value="OLDEST">Oldest</option>
                <option value="MOST_REVIEWS">Most reviews</option>
                <option value="AVG_TIPS">Highest avg tips</option>
                <option value="PCT_RECOMMENDED">Highest % recommended</option>
                <option value="AVG_HOURS">Highest avg hours</option>
              </select>
            </label>
          </div>

          <p className="mt-3 text-sm text-neutral-600">
            Showing {filteredVenues.length} of {venues.length} venues
          </p>
        </section>

        {/* Venues list */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Venues</h2>

          {loading && <p className="mt-4 text-neutral-600">Loading venues…</p>}
          {error && (
            <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {error}
            </pre>
          )}

          <div className="mt-4 grid gap-3">
            {filteredVenues.map((v) => (
              <button
                key={v.id}
                onClick={() => router.push(`/venues/${v.id}`)}
                className="text-left rounded-2xl border border-neutral-200 p-5 transition hover:bg-neutral-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{v.name}</div>
                    <div className="text-sm text-neutral-600">
                      {titleCase(v.city)}, {v.state}
                      {v.venue_type ? ` • ${titleCase(v.venue_type)}` : ""}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-700">
                      <span className="rounded-full border border-neutral-200 px-3 py-1">
                        {v.review_count}{" "}
                        {v.review_count === 1 ? "review" : "reviews"}
                      </span>

                      <span className="rounded-full border border-neutral-200 px-3 py-1">
                        Avg tips:{" "}
                        {v.avg_tips_weekly == null
                          ? "—"
                          : fmtMoney(v.avg_tips_weekly)}
                      </span>

                      <span className="rounded-full border border-neutral-200 px-3 py-1">
                        Recommended:{" "}
                        {v.pct_recommended == null
                          ? "—"
                          : fmtPct(v.pct_recommended)}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500">
                    {new Date(v.created_at).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Venue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venue_type: string | null;
  created_at: string;
};

type Review = {
  id: string;
  venue_id: string;
  role: string;
  tips_weekly: number | null;
  hours_weekly: number | null;
  tip_pool: boolean | null;
  busy_season: string | null;
  recommended: boolean;
  comment: string | null;
  earnings_label: string;
  created_at: string;
};

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function titleCase(s: string) {
  const cleaned = normalizeSpaces(s).toLowerCase();
  return cleaned.replace(/\b([a-z])/g, (m) => m.toUpperCase());
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

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

type ReviewSort = "newest" | "oldest" | "tips_desc" | "hours_desc";

function FlagIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6 3v18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 4h10l-1.5 3L18 10H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function VenuePage() {
  const params = useParams<{ id: string }>();
  const venueId = params?.id;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // Edit Venue UI
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editType, setEditType] = useState("");

  // Add review form
  const [role, setRole] = useState("server");
  const [recommended, setRecommended] = useState(false);
  const [comment, setComment] = useState("");
  const [tipsWeekly, setTipsWeekly] = useState<string>("");
  const [hoursWeekly, setHoursWeekly] = useState<string>("");
  const [tipPool, setTipPool] = useState<boolean>(false);
  const [busySeason, setBusySeason] = useState<string>("");
  const [earningsLabel, setEarningsLabel] = useState<"pre-tax" | "post-tax">(
    "pre-tax"
  );

  // City suggestions
  const [allCities, setAllCities] = useState<string[]>([]);

  // Review filters
  const [reviewSort, setReviewSort] = useState<ReviewSort>("newest");
  const [filterRecommendedOnly, setFilterRecommendedOnly] = useState(false);
  const [filterTipPoolOnly, setFilterTipPoolOnly] = useState(false);
  const [hideMissingForNumericSort, setHideMissingForNumericSort] =
    useState(true);

  // Report review
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(
    null
  );
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportedReviewIds, setReportedReviewIds] = useState<Set<string>>(
    () => new Set()
  );

  function openReport(reviewId: string) {
    setReportError(null);
    setReportReason("");
    setReportingReviewId(reviewId);
  }

  function closeReport() {
    if (reportSubmitting) return;
    setReportingReviewId(null);
    setReportReason("");
    setReportError(null);
  }

  async function submitReport() {
    if (!reportingReviewId) return;

    setReportSubmitting(true);
    setReportError(null);

    const payload = {
      target_type: "review",
      target_id: reportingReviewId,
      reason: reportReason.trim() ? reportReason.trim() : null,
    };

    const { error } = await supabase.from("reports").insert(payload);

    if (error) {
      setReportError(error.message);
      setReportSubmitting(false);
      return;
    }

    setReportedReviewIds((prev) => {
      const next = new Set(prev);
      next.add(reportingReviewId);
      return next;
    });

    setReportSubmitting(false);
    setReportingReviewId(null);
    setReportReason("");
  }

  async function loadCities() {
    const { data, error } = await supabase
      .from("venues")
      .select("city")
      .limit(1000);
    if (error) return;

    const set = new Set<string>();
    for (const row of data || []) {
      // @ts-expect-error supabase loose typing
      if (row.city) set.add(titleCase(row.city));
    }
    setAllCities(Array.from(set).sort((a, b) => a.localeCompare(b)));
  }

  async function loadVenue() {
    if (!venueId) return;

    setVenueLoading(true);
    setVenueError(null);

    const { data, error } = await supabase
      .from("venues")
      .select("id,name,city,state,venue_type,created_at")
      .eq("id", venueId)
      .single();

    if (error) {
      setVenue(null);
      setVenueError(error.message);
      setVenueLoading(false);
      return;
    }

    setVenue(data as Venue);
    setEditName(data.name ?? "");
    setEditCity(titleCase(data.city ?? ""));
    setEditType(data.venue_type ? titleCase(data.venue_type) : "");

    setVenueLoading(false);
  }

  // STEP 5: loadReviews() now ALSO preloads which reviews this browser already reported
  // so the "Report" button correctly shows "Reported" after refresh/navigation.
  async function loadReviews() {
    if (!venueId) return;

    setReviewsLoading(true);
    setReviewsError(null);

    // 1) Load latest reviews
    const reviewsRes = await supabase
      .from("reviews")
      .select(
        "id,venue_id,role,tips_weekly,hours_weekly,tip_pool,busy_season,recommended,comment,earnings_label,created_at"
      )
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (reviewsRes.error) {
      setReviews([]);
      setReviewsError(reviewsRes.error.message);
      setReviewsLoading(false);
      return;
    }

    const reviewRows = (reviewsRes.data || []) as Review[];
    setReviews(reviewRows);

    // 2) Preload "already reported" for only these review IDs
    const reviewIds = reviewRows.map((r) => r.id);
    if (reviewIds.length === 0) {
      setReportedReviewIds(new Set());
      setReviewsLoading(false);
      return;
    }

    const reportsRes = await supabase
      .from("reports")
      .select("target_id")
      .eq("target_type", "review")
      .in("target_id", reviewIds);

    if (!reportsRes.error) {
      const next = new Set<string>();
      for (const row of reportsRes.data || []) {
        // @ts-expect-error supabase loose typing
        if (row?.target_id) next.add(row.target_id as string);
      }
      setReportedReviewIds(next);
    }
    // If reports query fails (RLS/config), we just don't preload — UI still works.

    setReviewsLoading(false);
  }

  async function refreshAll() {
    await Promise.all([loadCities(), loadVenue(), loadReviews()]);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  const reviewCountLabel = useMemo(() => {
    const n = reviews.length;
    return `${n} ${n === 1 ? "review" : "reviews"}`;
  }, [reviews.length]);

  const editCitySuggestion = useMemo(
    () => bestCitySuggestion(editCity, allCities),
    [editCity, allCities]
  );

  // ---------- Summary stats ----------
  const summary = useMemo(() => {
    const total = reviews.length;

    const tipsVals = reviews
      .map((r) => r.tips_weekly)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

    const hoursVals = reviews
      .map((r) => r.hours_weekly)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

    const recommendedCount = reviews.filter((r) => r.recommended).length;

    const tipPoolKnown = reviews.filter((r) => r.tip_pool !== null);
    const tipPoolYes = tipPoolKnown.filter((r) => r.tip_pool === true).length;

    const avgTips =
      tipsVals.length > 0
        ? tipsVals.reduce((a, b) => a + b, 0) / tipsVals.length
        : null;

    const avgHours =
      hoursVals.length > 0
        ? hoursVals.reduce((a, b) => a + b, 0) / hoursVals.length
        : null;

    const pctRecommended = total > 0 ? (recommendedCount / total) * 100 : null;

    const pctTipPool =
      tipPoolKnown.length > 0 ? (tipPoolYes / tipPoolKnown.length) * 100 : null;

    return {
      total,
      avgTips,
      avgHours,
      pctRecommended,
      pctTipPool,
      tipsSample: tipsVals.length,
      hoursSample: hoursVals.length,
      tipPoolSample: tipPoolKnown.length,
    };
  }, [reviews]);

  // ---------- Filter + Sort reviews ----------
  const filteredSortedReviews = useMemo(() => {
    let list = [...reviews];

    if (filterRecommendedOnly) {
      list = list.filter((r) => r.recommended);
    }
    if (filterTipPoolOnly) {
      list = list.filter((r) => r.tip_pool === true);
    }

    const isNumericSort =
      reviewSort === "tips_desc" || reviewSort === "hours_desc";
    if (isNumericSort && hideMissingForNumericSort) {
      list = list.filter((r) =>
        reviewSort === "tips_desc"
          ? typeof r.tips_weekly === "number" && Number.isFinite(r.tips_weekly)
          : typeof r.hours_weekly === "number" &&
            Number.isFinite(r.hours_weekly)
      );
    }

    list.sort((a, b) => {
      if (reviewSort === "newest") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (reviewSort === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (reviewSort === "tips_desc") {
        const av =
          typeof a.tips_weekly === "number" ? a.tips_weekly : -Infinity;
        const bv =
          typeof b.tips_weekly === "number" ? b.tips_weekly : -Infinity;
        return bv - av;
      }
      if (reviewSort === "hours_desc") {
        const av =
          typeof a.hours_weekly === "number" ? a.hours_weekly : -Infinity;
        const bv =
          typeof b.hours_weekly === "number" ? b.hours_weekly : -Infinity;
        return bv - av;
      }
      return 0;
    });

    return list;
  }, [
    reviews,
    filterRecommendedOnly,
    filterTipPoolOnly,
    reviewSort,
    hideMissingForNumericSort,
  ]);

  async function saveVenueEdits() {
    if (!venueId) return;

    const name = normalizeSpaces(editName);
    const cityRaw = normalizeSpaces(editCity);
    const typeRaw = normalizeSpaces(editType);

    if (!name) {
      alert("Venue name is required.");
      return;
    }
    if (!cityRaw) {
      alert("City is required.");
      return;
    }

    if (editCitySuggestion) {
      const ok = window.confirm(
        `Did you mean "${editCitySuggestion}"?\n\nOK = use suggestion\nCancel = keep "${titleCase(cityRaw)}"`
      );
      if (ok) setEditCity(editCitySuggestion);
    }

    const city = titleCase(cityRaw);
    const venue_type = typeRaw ? titleCase(typeRaw) : null;

    const { error } = await supabase
      .from("venues")
      .update({ name, city, venue_type })
      .eq("id", venueId);

    if (error) {
      alert("Error saving venue: " + error.message);
      return;
    }

    setEditing(false);
    await refreshAll();
  }

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;

    const roleValue = normalizeSpaces(role);
    if (!roleValue) {
      alert("Role is required.");
      return;
    }

    const tips =
      tipsWeekly.trim() === "" ? null : Number.parseInt(tipsWeekly, 10);
    const hours =
      hoursWeekly.trim() === "" ? null : Number.parseInt(hoursWeekly, 10);

    if (tipsWeekly.trim() !== "" && (Number.isNaN(tips!) || tips! < 0)) {
      alert("Tips weekly must be a valid number (or blank).");
      return;
    }
    if (hoursWeekly.trim() !== "" && (Number.isNaN(hours!) || hours! < 0)) {
      alert("Hours weekly must be a valid number (or blank).");
      return;
    }

    const payload: Partial<Review> & { venue_id: string; role: string } = {
      venue_id: venueId,
      role: roleValue,
      recommended,
      earnings_label: earningsLabel,
      comment: comment.trim() || null,
      tips_weekly: tips,
      hours_weekly: hours,
      tip_pool: tipPool,
      busy_season: busySeason.trim() || null,
    };

    const { error } = await supabase.from("reviews").insert(payload);

    if (error) {
      alert("Error adding review: " + error.message);
      return;
    }

    setRecommended(false);
    setComment("");
    setTipsWeekly("");
    setHoursWeekly("");
    setTipPool(false);
    setBusySeason("");
    setEarningsLabel("pre-tax");
    setRole("server");

    await loadReviews();
  }

  if (!venueId) {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-red-600">Missing venue id in URL.</p>
          <Link className="underline" href="/">
            Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-neutral-700 hover:underline">
            ← Back
          </Link>
          <button
            onClick={refreshAll}
            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Refresh
          </button>
        </div>

        {venueLoading ? (
          <p className="mt-6 text-neutral-600">Loading venue…</p>
        ) : venueError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {venueError}
          </div>
        ) : !venue ? (
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5">
            Venue not found.
          </div>
        ) : (
          <>
            <section className="mt-6 rounded-2xl border border-neutral-200 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold">{venue.name}</h1>
                  <p className="mt-1 text-neutral-700">
                    {titleCase(venue.city)}, {venue.state}
                    {venue.venue_type ? ` • ${titleCase(venue.venue_type)}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {reviewCountLabel}
                  </p>
                </div>

                <button
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  {editing ? "Close edit" : "Edit venue"}
                </button>
              </div>

              {/* Summary stats */}
              <div className="mt-6 grid gap-3 md:grid-cols-5">
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Total reviews</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.total}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Avg tips / wk</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.avgTips == null ? "—" : fmtMoney(summary.avgTips)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    based on {summary.tipsSample}{" "}
                    {summary.tipsSample === 1 ? "entry" : "entries"}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Avg hours / wk</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.avgHours == null
                      ? "—"
                      : Math.round(summary.avgHours)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    based on {summary.hoursSample}{" "}
                    {summary.hoursSample === 1 ? "entry" : "entries"}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Recommended</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.pctRecommended == null
                      ? "—"
                      : fmtPct(summary.pctRecommended)}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Tip pool</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.pctTipPool == null
                      ? "—"
                      : fmtPct(summary.pctTipPool)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    based on {summary.tipPoolSample}{" "}
                    {summary.tipPoolSample === 1 ? "entry" : "entries"}
                  </div>
                </div>
              </div>

              {editing && (
                <div className="mt-6 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-2 md:col-span-2">
                      <span className="text-sm font-medium">Name</span>
                      <input
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Venue type</span>
                      <input
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                        placeholder="bar / restaurant…"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="grid gap-2">
                    <span className="text-sm font-medium">City</span>
                    <input
                      list="all-city-options"
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      placeholder="Type to see suggestions (or enter a new city)"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                    />
                    <datalist id="all-city-options">
                      {allCities.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>

                    {editCitySuggestion ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Did you mean{" "}
                        <span className="font-semibold">
                          “{editCitySuggestion}”
                        </span>
                        ?
                        <button
                          type="button"
                          onClick={() => setEditCity(editCitySuggestion)}
                          className="ml-3 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs hover:bg-amber-100"
                        >
                          Use suggestion
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        Suggestions help avoid typos. New cities are allowed.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={saveVenueEdits}
                      className="rounded-xl bg-black px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                      Save changes
                    </button>
                    <button
                      onClick={() => {
                        setEditName(venue.name ?? "");
                        setEditCity(titleCase(venue.city ?? ""));
                        setEditType(
                          venue.venue_type ? titleCase(venue.venue_type) : ""
                        );
                        setEditing(false);
                      }}
                      className="rounded-xl border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Reviews */}
            <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
              <h2 className="text-2xl font-semibold">Reviews</h2>

              {/* Filters + Sort */}
              <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Sort</span>
                    <select
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={reviewSort}
                      onChange={(e) =>
                        setReviewSort(e.target.value as ReviewSort)
                      }
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="tips_desc">Highest tips</option>
                      <option value="hours_desc">Highest hours</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={filterRecommendedOnly}
                      onChange={(e) =>
                        setFilterRecommendedOnly(e.target.checked)
                      }
                    />
                    <span className="text-sm">Recommended only</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={filterTipPoolOnly}
                      onChange={(e) => setFilterTipPoolOnly(e.target.checked)}
                    />
                    <span className="text-sm">Tip pool only</span>
                  </label>
                </div>

                {(reviewSort === "tips_desc" || reviewSort === "hours_desc") && (
                  <div className="mt-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={hideMissingForNumericSort}
                        onChange={(e) =>
                          setHideMissingForNumericSort(e.target.checked)
                        }
                      />
                      <span className="text-sm text-neutral-700">
                        Hide reviews missing{" "}
                        {reviewSort === "tips_desc" ? "tips" : "hours"} for this
                        sort
                      </span>
                    </label>
                  </div>
                )}

                <div className="mt-3 text-xs text-neutral-500">
                  Showing{" "}
                  <span className="font-medium">
                    {filteredSortedReviews.length}
                  </span>{" "}
                  of <span className="font-medium">{reviews.length}</span>{" "}
                  reviews
                </div>
              </div>

              {/* Add review form */}
              <form onSubmit={addReview} className="mt-6 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Role (required)</span>
                    <input
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Earnings label</span>
                    <select
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={earningsLabel}
                      onChange={(e) =>
                        setEarningsLabel(
                          e.target.value as "pre-tax" | "post-tax"
                        )
                      }
                    >
                      <option value="pre-tax">pre-tax</option>
                      <option value="post-tax">post-tax</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Tips weekly ($)</span>
                    <input
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      placeholder="e.g. 900"
                      value={tipsWeekly}
                      onChange={(e) => setTipsWeekly(e.target.value)}
                      inputMode="numeric"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Hours weekly</span>
                    <input
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      placeholder="e.g. 30"
                      value={hoursWeekly}
                      onChange={(e) => setHoursWeekly(e.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Busy season</span>
                  <input
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                    placeholder="Summer / Winter / Holidays…"
                    value={busySeason}
                    onChange={(e) => setBusySeason(e.target.value)}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Comment</span>
                  <textarea
                    className="min-h-[90px] w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                    placeholder="What should someone know before working here?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>

                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tipPool}
                      onChange={(e) => setTipPool(e.target.checked)}
                    />
                    <span className="text-sm">Tip pool</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recommended}
                      onChange={(e) => setRecommended(e.target.checked)}
                    />
                    <span className="text-sm">Recommended</span>
                  </label>
                </div>

                <button className="mt-2 w-full rounded-xl bg-black px-4 py-3 font-medium text-white hover:bg-neutral-800">
                  Submit review (no login)
                </button>
              </form>

              {/* Reviews list */}
              <div className="mt-8">
                <div className="flex items-end justify-between gap-4">
                  <h3 className="text-lg font-semibold">Recent reviews</h3>
                  <button
                    onClick={loadReviews}
                    className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    Refresh reviews
                  </button>
                </div>

                {reviewsLoading && (
                  <p className="mt-3 text-neutral-600">Loading reviews…</p>
                )}
                {reviewsError && (
                  <p className="mt-3 text-red-600">Error: {reviewsError}</p>
                )}

                {!reviewsLoading && filteredSortedReviews.length === 0 ? (
                  <p className="mt-3 text-neutral-600">
                    No reviews match these filters yet.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {filteredSortedReviews.map((r) => {
                      const alreadyReported = reportedReviewIds.has(r.id);
                      return (
                        <div
                          key={r.id}
                          className="rounded-2xl border border-neutral-200 p-5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">
                              {r.role}{" "}
                              <span className="text-sm font-normal text-neutral-600">
                                • {r.earnings_label}
                                {r.recommended ? " • Recommended" : ""}
                                {r.tip_pool === true ? " • Tip pool" : ""}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => openReport(r.id)}
                                disabled={alreadyReported}
                                title={
                                  alreadyReported
                                    ? "Reported (thank you)"
                                    : "Report this review"
                                }
                                className={`rounded-lg border px-2 py-1 text-xs hover:bg-neutral-50 ${
                                  alreadyReported
                                    ? "cursor-not-allowed border-neutral-200 text-neutral-400"
                                    : "border-neutral-200 text-neutral-700"
                                }`}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <FlagIcon className="h-4 w-4" />
                                  {alreadyReported ? "Reported" : "Report"}
                                </span>
                              </button>

                              <div className="text-xs text-neutral-500">
                                {new Date(r.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 text-sm text-neutral-700">
                            {r.tips_weekly != null
                              ? `Tips/wk: $${r.tips_weekly}`
                              : "Tips/wk: —"}
                            {" • "}
                            {r.hours_weekly != null
                              ? `Hours/wk: ${r.hours_weekly}`
                              : "Hours/wk: —"}
                            {" • "}
                            {r.busy_season ? `Busy: ${r.busy_season}` : "Busy: —"}
                          </div>

                          {r.comment ? (
                            <p className="mt-3 text-neutral-800">{r.comment}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* Report modal */}
        {reportingReviewId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeReport();
            }}
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">Report review</h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    Thanks — reports help keep data clean. Add a quick reason
                    (optional).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeReport}
                  disabled={reportSubmitting}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 disabled:cursor-not-allowed"
                >
                  Close
                </button>
              </div>

              <label className="mt-4 grid gap-2">
                <span className="text-sm font-medium">Reason (optional)</span>
                <textarea
                  className="min-h-[90px] w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                  placeholder="e.g. spam, inaccurate tips, wrong venue, abusive language…"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  disabled={reportSubmitting}
                />
              </label>

              {reportError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {reportError}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submitReport}
                  disabled={reportSubmitting}
                  className="rounded-xl bg-black px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                >
                  {reportSubmitting ? "Submitting…" : "Submit report"}
                </button>

                <button
                  type="button"
                  onClick={closeReport}
                  disabled={reportSubmitting}
                  className="rounded-xl border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

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
  is_hidden: boolean | null;
};

type CityRow = { city: string | null };
type ReportRow = { target_id: string | null };

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function titleCase(s: string) {
  const cleaned = normalizeSpaces(s).toLowerCase();
  return cleaned.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6 4h10l-1.5 3L18 10H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** ---------------------------
 * Anti-spam: anonymous reviewer token
 * --------------------------- */
const ANON_TOKEN_KEY = "kt_anon_token";
const reviewedKey = (venueId: string) => `kt_reviewed_${venueId}`;

function randomToken() {
  // Simple, stable-enough token for anon users (not security-sensitive)
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateAnonToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(ANON_TOKEN_KEY);
    if (existing && existing.length >= 8) return existing;
    const created = randomToken();
    window.localStorage.setItem(ANON_TOKEN_KEY, created);
    return created;
  } catch {
    // If localStorage is blocked, we fall back to in-memory behavior (no hard block possible)
    return "";
  }
}

function hasReviewedVenue(venueId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(reviewedKey(venueId)) === "1";
  } catch {
    return false;
  }
}

function markReviewedVenue(venueId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(reviewedKey(venueId), "1");
  } catch {
    // ignore
  }
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
  const [earningsLabel, setEarningsLabel] = useState<"pre-tax" | "post-tax">("pre-tax");

  // City suggestions
  const [allCities, setAllCities] = useState<string[]>([]);

  // Review filters
  const [reviewSort, setReviewSort] = useState<ReviewSort>("newest");
  const [filterRecommendedOnly, setFilterRecommendedOnly] = useState(false);
  const [filterTipPoolOnly, setFilterTipPoolOnly] = useState(false);
  const [hideMissingForNumericSort, setHideMissingForNumericSort] = useState(true);

  // Report review
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportedReviewIds, setReportedReviewIds] = useState<Set<string>>(() => new Set());

  // Anti-spam (one review per venue per browser/device)
  const [anonToken, setAnonToken] = useState<string>("");
  const [alreadyReviewedHere, setAlreadyReviewedHere] = useState(false);

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
    const { data, error } = await supabase.from("venues").select("city").limit(1000);
    if (error) return;

    const rows = (data || []) as CityRow[];

    const set = new Set<string>();
    for (const row of rows) {
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
    setEditName((data as Venue).name ?? "");
    setEditCity(titleCase((data as Venue).city ?? ""));
    setEditType((data as Venue).venue_type ? titleCase((data as Venue).venue_type!) : "");

    setVenueLoading(false);
  }

  // include rows where is_hidden is NULL or false
  async function loadReviews() {
    if (!venueId) return;

    setReviewsLoading(true);
    setReviewsError(null);

    const reviewsRes = await supabase
      .from("reviews")
      .select(
        "id,venue_id,role,tips_weekly,hours_weekly,tip_pool,busy_season,recommended,comment,earnings_label,created_at,is_hidden"
      )
      .eq("venue_id", venueId)
      .not("is_hidden", "is", true)
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
      const reportRows = (reportsRes.data || []) as ReportRow[];
      const next = new Set<string>();
      for (const row of reportRows) {
        if (row?.target_id) next.add(row.target_id);
      }
      setReportedReviewIds(next);
    }

    setReviewsLoading(false);
  }

  async function refreshAll() {
    await Promise.all([loadCities(), loadVenue(), loadReviews()]);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  // Setup anon token + localStorage review lock for this venue
  useEffect(() => {
    if (!venueId) return;
    const tok = getOrCreateAnonToken();
    setAnonToken(tok);
    setAlreadyReviewedHere(hasReviewedVenue(venueId));
  }, [venueId]);

  const reviewCountLabel = useMemo(() => {
    const n = reviews.length;
    return `${n} ${n === 1 ? "review" : "reviews"}`;
  }, [reviews.length]);

  const editCitySuggestion = useMemo(() => bestCitySuggestion(editCity, allCities), [editCity, allCities]);

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

    const avgTips = tipsVals.length > 0 ? tipsVals.reduce((a, b) => a + b, 0) / tipsVals.length : null;

    const avgHours = hoursVals.length > 0 ? hoursVals.reduce((a, b) => a + b, 0) / hoursVals.length : null;

    const pctRecommended = total > 0 ? (recommendedCount / total) * 100 : null;

    const pctTipPool = tipPoolKnown.length > 0 ? (tipPoolYes / tipPoolKnown.length) * 100 : null;

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

  const filteredSortedReviews = useMemo(() => {
    let list = [...reviews];

    if (filterRecommendedOnly) list = list.filter((r) => r.recommended);
    if (filterTipPoolOnly) list = list.filter((r) => r.tip_pool === true);

    const isNumericSort = reviewSort === "tips_desc" || reviewSort === "hours_desc";
    if (isNumericSort && hideMissingForNumericSort) {
      list = list.filter((r) =>
        reviewSort === "tips_desc"
          ? typeof r.tips_weekly === "number" && Number.isFinite(r.tips_weekly)
          : typeof r.hours_weekly === "number" && Number.isFinite(r.hours_weekly)
      );
    }

    list.sort((a, b) => {
      if (reviewSort === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (reviewSort === "oldest") {
        // FIXED: previously subtracted the same value from itself
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (reviewSort === "tips_desc") {
        const av = typeof a.tips_weekly === "number" ? a.tips_weekly : -Infinity;
        const bv = typeof b.tips_weekly === "number" ? b.tips_weekly : -Infinity;
        return bv - av;
      }
      if (reviewSort === "hours_desc") {
        const av = typeof a.hours_weekly === "number" ? a.hours_weekly : -Infinity;
        const bv = typeof b.hours_weekly === "number" ? b.hours_weekly : -Infinity;
        return bv - av;
      }
      return 0;
    });

    return list;
  }, [reviews, filterRecommendedOnly, filterTipPoolOnly, reviewSort, hideMissingForNumericSort]);

  async function saveVenueEdits() {
    if (!venueId) return;

    const name = normalizeSpaces(editName);
    const cityRaw = normalizeSpaces(editCity);
    const typeRaw = normalizeSpaces(editType);

    if (!name) return alert("Venue name is required.");
    if (!cityRaw) return alert("City is required.");

    if (editCitySuggestion) {
      const ok = window.confirm(
        `Did you mean "${editCitySuggestion}"?\n\nOK = use suggestion\nCancel = keep "${titleCase(cityRaw)}"`
      );
      if (ok) setEditCity(editCitySuggestion);
    }

    const city = titleCase(cityRaw);
    const venue_type = typeRaw ? titleCase(typeRaw) : null;

    const { error } = await supabase.from("venues").update({ name, city, venue_type }).eq("id", venueId);

    if (error) return alert("Error saving venue: " + error.message);

    setEditing(false);
    await refreshAll();
  }

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;

    // Frontend safeguard (browser/device)
    if (alreadyReviewedHere) {
      alert("You’ve already submitted a review for this venue from this device.");
      return;
    }

    const roleValue = normalizeSpaces(role);
    if (!roleValue) return alert("Role is required.");

    const tips = tipsWeekly.trim() === "" ? null : Number.parseInt(tipsWeekly, 10);
    const hours = hoursWeekly.trim() === "" ? null : Number.parseInt(hoursWeekly, 10);

    if (tipsWeekly.trim() !== "" && (Number.isNaN(tips!) || tips! < 0)) {
      return alert("Tips weekly must be a valid number (or blank).");
    }
    if (hoursWeekly.trim() !== "" && (Number.isNaN(hours!) || hours! < 0)) {
      return alert("Hours weekly must be a valid number (or blank).");
    }

    const payload: any = {
      venue_id: venueId,
      role: roleValue,
      recommended,
      earnings_label: earningsLabel,
      comment: comment.trim() || null,
      tips_weekly: tips,
      hours_weekly: hours,
      tip_pool: tipPool,
      busy_season: busySeason.trim() || null,

      // DB enforcement layer (unique index should be venue_id + reviewer_token)
      reviewer_token: anonToken || null,
    };

    const { error } = await supabase.from("reviews").insert(payload);

    if (error) {
      const msg = (error as any)?.message || "Unknown error";
      const code = (error as any)?.code;

      // Unique violation usually 23505; also handle message containing duplicate
      if (code === "23505" || msg.toLowerCase().includes("duplicate")) {
        markReviewedVenue(venueId);
        setAlreadyReviewedHere(true);
        alert("You’ve already submitted a review for this venue from this device.");
        return;
      }

      return alert("Error adding review: " + msg);
    }

    // Mark this device as having reviewed this venue
    markReviewedVenue(venueId);
    setAlreadyReviewedHere(true);

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
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{venueError}</div>
        ) : !venue ? (
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5">Venue not found.</div>
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
                  <p className="mt-1 text-sm text-neutral-600">{reviewCountLabel}</p>
                </div>

                <button
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  {editing ? "Close edit" : "Edit venue"}
                </button>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-5">
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Total reviews</div>
                  <div className="mt-1 text-2xl font-semibold">{summary.total}</div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Avg tips / wk</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.avgTips == null ? "—" : fmtMoney(summary.avgTips)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    based on {summary.tipsSample} {summary.tipsSample === 1 ? "entry" : "entries"}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Avg hours / wk</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.avgHours == null ? "—" : Math.round(summary.avgHours)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    based on {summary.hoursSample} {summary.hoursSample === 1 ? "entry" : "entries"}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Recommended</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.pctRecommended == null ? "—" : fmtPct(summary.pctRecommended)}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-xs text-neutral-500">Tip pool</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {summary.pctTipPool == null ? "—" : fmtPct(summary.pctTipPool)}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    based on {summary.tipPoolSample} {summary.tipPoolSample === 1 ? "entry" : "entries"}
                  </div>
                </div>
              </div>

              {editing && (
                <div className="mt-6 grid gap-3 rounded-2xl border border-neutral-200 p-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Venue name</label>
                    <input
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">City</label>
                    <input
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                    />
                    {editCitySuggestion ? (
                      <p className="text-xs text-neutral-600">
                        Suggestion: <span className="font-medium">{editCitySuggestion}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Venue type</label>
                    <input
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      placeholder="Bar, Restaurant, Club…"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={saveVenueEdits}
                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-xl border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Add a review (separate bubble, ABOVE Reviews) */}
            <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
              <h2 className="text-2xl font-semibold">Add a review</h2>

              {alreadyReviewedHere ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  You’ve already submitted a review for this venue from this device.  
                  <div className="mt-1 text-xs text-amber-800">
                    (This is a simple anti-spam safeguard while the site remains login-free.)
                  </div>
                </div>
              ) : null}

              <form onSubmit={addReview} className="mt-4 grid gap-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Role</span>
                    <input
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="server, bartender…"
                      disabled={alreadyReviewedHere}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Earnings</span>
                    <select
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={earningsLabel}
                      onChange={(e) => setEarningsLabel(e.target.value as "pre-tax" | "post-tax")}
                      disabled={alreadyReviewedHere}
                    >
                      <option value="pre-tax">pre-tax</option>
                      <option value="post-tax">post-tax</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Tips / week (optional)</span>
                    <input
                      inputMode="numeric"
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={tipsWeekly}
                      onChange={(e) => setTipsWeekly(e.target.value)}
                      placeholder="e.g. 1200"
                      disabled={alreadyReviewedHere}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Hours / week (optional)</span>
                    <input
                      inputMode="numeric"
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={hoursWeekly}
                      onChange={(e) => setHoursWeekly(e.target.value)}
                      placeholder="e.g. 32"
                      disabled={alreadyReviewedHere}
                    />
                  </label>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={recommended}
                      onChange={(e) => setRecommended(e.target.checked)}
                      disabled={alreadyReviewedHere}
                    />
                    <span className="text-sm">Recommended</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={tipPool}
                      onChange={(e) => setTipPool(e.target.checked)}
                      disabled={alreadyReviewedHere}
                    />
                    <span className="text-sm">Tip pool</span>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Busy season (optional)</span>
                  <input
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                    value={busySeason}
                    onChange={(e) => setBusySeason(e.target.value)}
                    placeholder="Summer, holidays, year-round…"
                    disabled={alreadyReviewedHere}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Comment (optional)</span>
                  <textarea
                    className="min-h-[110px] w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Anonymous notes about management, volume, schedule…"
                    disabled={alreadyReviewedHere}
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={alreadyReviewedHere}
                    className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Submit review
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecommended(false);
                      setComment("");
                      setTipsWeekly("");
                      setHoursWeekly("");
                      setTipPool(false);
                      setBusySeason("");
                      setEarningsLabel("pre-tax");
                      setRole("server");
                    }}
                    disabled={alreadyReviewedHere}
                    className="rounded-xl border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </section>

            {/* Reviews (separate bubble, directly above sort controls + review list) */}
            <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
              <h2 className="text-2xl font-semibold">Reviews</h2>

              <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Sort</span>
                    <select
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                      value={reviewSort}
                      onChange={(e) => setReviewSort(e.target.value as ReviewSort)}
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
                      onChange={(e) => setFilterRecommendedOnly(e.target.checked)}
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
                        onChange={(e) => setHideMissingForNumericSort(e.target.checked)}
                      />
                      <span className="text-sm text-neutral-700">
                        Hide reviews missing {reviewSort === "tips_desc" ? "tips" : "hours"} for this sort
                      </span>
                    </label>
                  </div>
                )}

                <div className="mt-3 text-xs text-neutral-500">
                  Showing <span className="font-medium">{filteredSortedReviews.length}</span> of{" "}
                  <span className="font-medium">{reviews.length}</span> reviews
                </div>
              </div>

              {!reviewsLoading && !reviewsError && reviews.length === 0 && (
                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-neutral-700">
                  <p className="font-medium">No reviews yet.</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    Be the first to add one — it only takes a minute and helps other workers.
                  </p>
                </div>
              )}

              <div className="mt-6">
                {reviewsLoading ? (
                  <p className="text-sm text-neutral-600">Loading reviews…</p>
                ) : reviewsError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {reviewsError}
                  </div>
                ) : filteredSortedReviews.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-700">
                    No reviews yet. Be the first to add one.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {filteredSortedReviews.map((r) => {
                      const alreadyReported = reportedReviewIds.has(r.id);

                      return (
                        <div key={r.id} className="rounded-2xl border border-neutral-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                {titleCase(r.role)}
                                <span className="ml-2 text-xs font-normal text-neutral-500">
                                  {new Date(r.created_at).toLocaleDateString()}
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-700">
                                <span className="rounded-full border border-neutral-200 px-2 py-1">
                                  Tips: {typeof r.tips_weekly === "number" ? fmtMoney(r.tips_weekly) : "—"} (
                                  {r.earnings_label})
                                </span>
                                <span className="rounded-full border border-neutral-200 px-2 py-1">
                                  Hours: {typeof r.hours_weekly === "number" ? Math.round(r.hours_weekly) : "—"}
                                </span>
                                <span className="rounded-full border border-neutral-200 px-2 py-1">
                                  Recommended: {r.recommended ? "Yes" : "No"}
                                </span>
                                <span className="rounded-full border border-neutral-200 px-2 py-1">
                                  Tip pool: {r.tip_pool === null ? "—" : r.tip_pool ? "Yes" : "No"}
                                </span>
                                {r.busy_season ? (
                                  <span className="rounded-full border border-neutral-200 px-2 py-1">
                                    Busy: {r.busy_season}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-60"
                              onClick={() => openReport(r.id)}
                              disabled={alreadyReported}
                              title={alreadyReported ? "Already reported" : "Report this review"}
                            >
                              <FlagIcon className="h-4 w-4" />
                              {alreadyReported ? "Reported" : "Report"}
                            </button>
                          </div>

                          {r.comment ? (
                            <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-800">{r.comment}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {reportingReviewId ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Report review</h3>
                      <p className="mt-1 text-sm text-neutral-600">Optional: tell us why. This stays anonymous.</p>
                    </div>
                    <button
                      onClick={closeReport}
                      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                    >
                      Close
                    </button>
                  </div>

                  <textarea
                    className="mt-4 min-h-[120px] w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Reason (optional)…"
                    disabled={reportSubmitting}
                  />

                  {reportError ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {reportError}
                    </div>
                  ) : null}

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={submitReport}
                      disabled={reportSubmitting}
                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {reportSubmitting ? "Submitting…" : "Submit report"}
                    </button>
                    <button
                      onClick={closeReport}
                      disabled={reportSubmitting}
                      className="rounded-xl border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

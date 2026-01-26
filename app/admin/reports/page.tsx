"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ReportRow = {
  id: string;
  target_type: "venue" | "review";
  target_id: string;
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type ReviewRow = {
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
  is_hidden: boolean;
};

type VenueRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  venue_type: string | null;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString();
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewReports, setReviewReports] = useState<ReportRow[]>([]);
  const [venueReports, setVenueReports] = useState<ReportRow[]>([]);

  const [reviewsById, setReviewsById] = useState<Record<string, ReviewRow>>({});
  const [venuesById, setVenuesById] = useState<Record<string, VenueRow>>({});

  async function loadAll() {
    setLoading(true);
    setError(null);

    // reports (admin-only via RLS)
    const { data: reports, error: repErr } = await supabase
      .from("reports")
      .select("id,target_type,target_id,reason,created_at,resolved_at,resolved_by")
      .order("created_at", { ascending: false })
      .limit(500);

    if (repErr) {
      setError(repErr.message);
      setLoading(false);
      return;
    }

    const r = (reports || []) as ReportRow[];
    const rr = r.filter((x) => x.target_type === "review");
    const vr = r.filter((x) => x.target_type === "venue");

    setReviewReports(rr);
    setVenueReports(vr);

    // fetch referenced reviews/venues
    const reviewIds = Array.from(new Set(rr.map((x) => x.target_id)));
    const venueIdsFromReports = Array.from(new Set(vr.map((x) => x.target_id)));

    // Reviews
    let reviewRows: ReviewRow[] = [];
    if (reviewIds.length > 0) {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          "id,venue_id,role,tips_weekly,hours_weekly,tip_pool,busy_season,recommended,comment,earnings_label,created_at,is_hidden"
        )
        .in("id", reviewIds);

      if (!error) reviewRows = (data || []) as ReviewRow[];
    }

    const reviewMap: Record<string, ReviewRow> = {};
    for (const row of reviewRows) reviewMap[row.id] = row;
    setReviewsById(reviewMap);

    // Venues referenced by review rows + venue reports
    const venueIds = Array.from(
      new Set([
        ...venueIdsFromReports,
        ...reviewRows.map((x) => x.venue_id).filter(Boolean),
      ])
    );

    let venueRows: VenueRow[] = [];
    if (venueIds.length > 0) {
      const { data, error } = await supabase
        .from("venues")
        .select("id,name,city,state,venue_type")
        .in("id", venueIds);

      if (!error) venueRows = (data || []) as VenueRow[];
    }

    const venueMap: Record<string, VenueRow> = {};
    for (const row of venueRows) venueMap[row.id] = row;
    setVenuesById(venueMap);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const reviewCount = useMemo(
    () => reviewReports.filter((r) => !r.resolved_at).length,
    [reviewReports]
  );
  const venueCount = useMemo(
    () => venueReports.filter((r) => !r.resolved_at).length,
    [venueReports]
  );

  async function resolveReport(reportId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("reports")
      .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", reportId);

    if (error) {
      alert("Error resolving report: " + error.message);
      return;
    }

    await loadAll();
  }

  async function hideReview(reviewId: string) {
    const ok = window.confirm("Hide this review from the public?");
    if (!ok) return;

    const { error } = await supabase.from("reviews").update({ is_hidden: true }).eq("id", reviewId);

    if (error) {
      alert("Error hiding review: " + error.message);
      return;
    }

    await loadAll();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Admin · Reports</h1>
          <div className="flex gap-2">
            <button
              onClick={loadAll}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Refresh
            </button>
            <Link
              href="/"
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Home
            </Link>
            <button
              onClick={signOut}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 p-5">
            <div className="text-xs text-neutral-500">Review reports (unresolved)</div>
            <div className="mt-1 text-3xl font-semibold">{reviewCount}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-5">
            <div className="text-xs text-neutral-500">Venue reports (unresolved)</div>
            <div className="mt-1 text-3xl font-semibold">{venueCount}</div>
          </div>
        </div>

        {loading && <p className="mt-6 text-neutral-600">Loading…</p>}
        {error && (
          <pre className="mt-6 whitespace-pre-wrap rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </pre>
        )}

        {/* Review reports */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Review reports</h2>

          {!loading && reviewReports.length === 0 ? (
            <p className="mt-2 text-neutral-600">No review reports.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {reviewReports.map((r) => {
                const review = reviewsById[r.target_id];
                const venue = review ? venuesById[review.venue_id] : null;

                return (
                  <div key={r.id} className="rounded-2xl border border-neutral-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-neutral-600">
                          Reported: {fmtDate(r.created_at)}
                          {r.resolved_at ? ` · Resolved: ${fmtDate(r.resolved_at)}` : ""}
                        </div>
                        <div className="mt-1 font-semibold">
                          {venue ? (
                            <Link href={`/venues/${venue.id}`} className="hover:underline">
                              {venue.name} · {venue.city}, {venue.state}
                            </Link>
                          ) : (
                            <span>Venue: (not found)</span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-neutral-700">
                          Reason: {r.reason?.trim() ? r.reason : "—"}
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                          {review ? (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{review.role}</span>
                                <span className="text-neutral-600">· {review.earnings_label}</span>
                                {review.recommended ? <span className="text-neutral-600">· Recommended</span> : null}
                                {review.tip_pool === true ? <span className="text-neutral-600">· Tip pool</span> : null}
                                {review.is_hidden ? (
                                  <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-xs">
                                    Hidden
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 text-neutral-700">
                                Tips/wk: {review.tips_weekly ?? "—"} · Hours/wk: {review.hours_weekly ?? "—"} · Busy:{" "}
                                {review.busy_season ?? "—"}
                              </div>
                              {review.comment ? <div className="mt-2 text-neutral-800">{review.comment}</div> : null}
                            </>
                          ) : (
                            <div className="text-neutral-600">Review not found (may have been deleted).</div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {!r.resolved_at && (
                          <button
                            onClick={() => resolveReport(r.id)}
                            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                          >
                            Resolve
                          </button>
                        )}
                        {review && !review.is_hidden && (
                          <button
                            onClick={() => hideReview(review.id)}
                            className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                          >
                            Hide review
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Venue reports (kept for later) */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Venue reports</h2>
          <p className="mt-1 text-sm text-neutral-600">(Keeping this section for later.)</p>

          {!loading && venueReports.length === 0 ? (
            <p className="mt-2 text-neutral-600">No venue reports.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {venueReports.map((r) => (
                <div key={r.id} className="rounded-2xl border border-neutral-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-neutral-600">
                        Reported: {fmtDate(r.created_at)}
                        {r.resolved_at ? ` · Resolved: ${fmtDate(r.resolved_at)}` : ""}
                      </div>
                      <div className="mt-1 text-sm text-neutral-700">Reason: {r.reason?.trim() ? r.reason : "—"}</div>
                    </div>

                    {!r.resolved_at && (
                      <button
                        onClick={() => resolveReport(r.id)}
                        className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

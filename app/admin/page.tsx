"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function titleCase(s: string) {
  const cleaned = normalizeSpaces(s).toLowerCase();
  return cleaned.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export default function AdminPage() {
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [mergeLoading, setMergeLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadCities() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.from("venues").select("city").limit(2000);

    if (error) {
      setMsg("Failed to load cities: " + error.message);
      setCities([]);
      setLoading(false);
      return;
    }

    const set = new Set<string>();
    for (const row of data || []) {
      if (row.city) set.add(titleCase(row.city));
    }

    setCities(Array.from(set).sort((a, b) => a.localeCompare(b)));
    setLoading(false);
  }

  useEffect(() => {
    loadCities();
  }, []);

  const fromSuggestion = useMemo(() => {
    const v = titleCase(mergeFrom);
    return cities.find((c) => c.toLowerCase() === v.toLowerCase()) ?? null;
  }, [mergeFrom, cities]);

  const toSuggestion = useMemo(() => {
    const v = titleCase(mergeTo);
    return cities.find((c) => c.toLowerCase() === v.toLowerCase()) ?? null;
  }, [mergeTo, cities]);

  async function mergeCities() {
    setMsg(null);

    const fromRaw = normalizeSpaces(mergeFrom);
    const toRaw = normalizeSpaces(mergeTo);

    if (!fromRaw || !toRaw) return setMsg("Pick both From and To cities.");

    const from = titleCase(fromRaw);
    const to = titleCase(toRaw);

    if (from.toLowerCase() === to.toLowerCase()) return setMsg("From and To are the same city.");

    const ok = window.confirm(
      `Merge city "${from}" → "${to}"?\n\nThis will update ALL venues currently in "${from}" to "${to}".`
    );
    if (!ok) return;

    setMergeLoading(true);

    // Case-insensitive exact match using ilike without wildcards.
    const { error } = await supabase.from("venues").update({ city: to }).ilike("city", from);

    if (error) {
      setMsg("Merge failed: " + error.message);
      setMergeLoading(false);
      return;
    }

    setMsg(`Merged "${from}" → "${to}".`);
    setMergeFrom("");
    setMergeTo("");
    await loadCities();
    setMergeLoading(false);
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Admin</h1>
          <Link href="/" className="text-sm text-neutral-700 hover:underline">
            ← Back to site
          </Link>
        </div>

        <p className="mt-2 text-neutral-600">Private tools. Don’t share this link.</p>

        <section className="mt-8 rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-xl font-semibold">Merge cities</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Fix typos/duplicates by merging one city into another (updates venues in the database).
          </p>

          {loading ? (
            <p className="mt-4 text-neutral-600">Loading cities…</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <span className="text-sm font-medium">From (typo/duplicate)</span>
                  <input
                    list="cities-from"
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                    placeholder="e.g. Jersesy City"
                    value={mergeFrom}
                    onChange={(e) => setMergeFrom(e.target.value)}
                  />
                  <datalist id="cities-from">
                    {cities.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  {fromSuggestion ? (
                    <p className="text-xs text-neutral-500">Matched existing city: {fromSuggestion}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <span className="text-sm font-medium">To (correct city)</span>
                  <input
                    list="cities-to"
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                    placeholder="e.g. Jersey City"
                    value={mergeTo}
                    onChange={(e) => setMergeTo(e.target.value)}
                  />
                  <datalist id="cities-to">
                    {cities.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  {toSuggestion ? (
                    <p className="text-xs text-neutral-500">Matched existing city: {toSuggestion}</p>
                  ) : null}
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={mergeCities}
                    disabled={mergeLoading}
                    className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {mergeLoading ? "Merging..." : "Merge"}
                  </button>
                </div>
              </div>

              {msg ? <p className="mt-4 text-sm text-neutral-800">{msg}</p> : null}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={loadCities}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  Refresh cities
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

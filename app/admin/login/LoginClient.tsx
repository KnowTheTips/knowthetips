"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextPath = sp.get("next") || "/admin/reports";

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, go to admin
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextPath);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    router.replace(nextPath);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // you can set this later to your prod domain; localhost works for now
        emailRedirectTo: `${window.location.origin}${nextPath}`,
      },
    });

    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Magic link sent. Check your email.");
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin login</h1>
          <Link href="/" className="text-sm text-neutral-700 hover:underline">
            Home
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 p-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`rounded-xl border px-3 py-2 text-sm ${
                mode === "password" ? "border-black" : "border-neutral-200"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`rounded-xl border px-3 py-2 text-sm ${
                mode === "magic" ? "border-black" : "border-neutral-200"
              }`}
            >
              Magic link
            </button>
          </div>

          <p className="mt-3 text-sm text-neutral-600">
            Use the same email you inserted into <code>admin_users</code>.
          </p>

          {mode === "password" ? (
            <form onSubmit={signInWithPassword} className="mt-4 grid gap-3">
              <input
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-black px-4 py-3 font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={sendMagicLink} className="mt-4 grid gap-3">
              <input
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <button
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-black px-4 py-3 font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>
          )}

          {status && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {status}
            </div>
          )}
        </div>

        <div className="mt-6 text-sm text-neutral-600">
          Need a password user?
          <div className="mt-1">
            In Supabase → Authentication → Users → “Add user”.
          </div>
        </div>
      </div>
    </main>
  );
}

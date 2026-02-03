import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KnowTheTips",
  description:
    "Anonymous venue insights for bartenders and servers — tips, hours, tip pool, busy season, and real-world job reviews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const googleSrc = apiKey
    ? `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        apiKey
      )}&libraries=places&loading=async`
    : null;

  return (
    <html lang="en">
      <head>
        {/* Helps Safari / iOS render form controls + text with intended light colors */}
        <meta name="color-scheme" content="light" />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} subpixel-antialiased text-neutral-900`}
        style={{
          // Defensive: nudges "reader/darkening" tools to keep contrast sane
          backgroundColor: "#ffffff",
          color: "#171717",
        }}
      >
        {googleSrc ? (
          <Script id="google-maps-js" src={googleSrc} strategy="afterInteractive" />
        ) : null}

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            {/* Left: brand */}
            <Link href="/" className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-9 w-9 rounded-2xl bg-black"
              />
              <span className="text-base font-semibold text-neutral-900">
                KnowTheTips
              </span>
            </Link>

            {/* Center: nav (desktop) */}
            <nav className="hidden items-center gap-8 text-sm text-neutral-700 md:flex">
              <Link href="/how-it-works" className="hover:text-neutral-900">
                How it works
              </Link>
              {/* These can point to sections on the homepage if you want */}
              <Link href="/#browse" className="hover:text-neutral-900">
                Browse
              </Link>
              <Link href="/#add-venue" className="hover:text-neutral-900">
                Add a venue
              </Link>
            </nav>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              {/* Placeholder (won't break anything). You can wire this later. */}
              <button
                type="button"
                className="hidden rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 md:inline-flex"
                title="Sign in coming soon"
                disabled
              >
                Sign in
              </button>

              <Link
                href="/#add-venue"
                className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Add a venue
              </Link>
            </div>
          </div>
        </header>

        {children}

        <Footer />
      </body>
    </html>
  );
}

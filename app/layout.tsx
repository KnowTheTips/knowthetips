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
          <Script
            id="google-maps-js"
            src={googleSrc}
            strategy="afterInteractive"
          />
        ) : null}

        {/* Header */}
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-base font-semibold text-neutral-900">
              KnowTheTips
            </Link>

            <nav className="flex items-center gap-6">
              <Link href="/" className="text-sm text-neutral-700 hover:underline">
                Home
              </Link>
              <Link
                href="/how-it-works"
                className="text-sm text-neutral-700 hover:underline"
              >
                How it works
              </Link>
            </nav>
          </div>
        </header>

        {children}

        <Footer />
      </body>
    </html>
  );
}

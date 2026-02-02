// app/layout.tsx
return (
  <html lang="en">
    <body
      className={`${geistSans.variable} ${geistMono.variable} antialiased text-neutral-900`}
    >
      {googleSrc ? (
        <Script id="google-maps-js" src={googleSrc} strategy="afterInteractive" />
      ) : null}

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-base font-semibold">
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

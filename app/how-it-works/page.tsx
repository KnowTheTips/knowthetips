export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">How KnowTheTips works</h1>

        <p className="mt-4 text-neutral-700">
          KnowTheTips is an anonymous review platform for <span className="font-medium">bartenders and servers</span>{" "}
          to share real-world job info about venues—tips, hours, tip pool, busy seasons, and what it’s actually like
          to work there.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">What you can do</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-neutral-700">
              <li>Search for venues and view details</li>
              <li>Add a venue if it’s missing</li>
              <li>Submit an anonymous review (tips, hours, tip pool, busy season, comments)</li>
              <li>Browse aggregate stats for each venue</li>
              <li>Report a review if it looks suspicious</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">Anonymous by design</h2>
            <p className="mt-3 text-neutral-700">
              Reviews are submitted without showing names. Please don’t include personal identifying information
              (yours or anyone else’s) in comments.
            </p>
            <p className="mt-3 text-sm text-neutral-600">
              Note: in a future update, we may add lightweight email verification to reduce spam and keep data quality
              high—without publicly displaying emails.
            </p>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5 md:col-span-2">
            <h2 className="text-lg font-semibold">Important disclaimer</h2>
            <p className="mt-3 text-neutral-700">
              Reviews reflect individual experiences and are not verified facts. KnowTheTips isn’t affiliated with
              any venue listed. Use this site as a starting point—your experience may vary.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

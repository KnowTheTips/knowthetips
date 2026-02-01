export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">How KnowTheTips Works</h1>

        <p className="mt-4 text-neutral-700">
          KnowTheTips is an anonymous review platform for service industry workers
          to share real-world job insights about venues — tips, hours, tip pool,
          busy season, and more.
        </p>

        <div className="mt-8 grid gap-4">
          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">What you can do</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-700">
              <li>Search for venues and view details</li>
              <li>Submit an anonymous review (tips, hours, and experience)</li>
              <li>Browse aggregated stats for each venue</li>
              <li>Report a review if it looks suspicious</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">Anonymous by design</h2>
            <p className="mt-2 text-neutral-700">
              Reviews are submitted without accounts. Please don’t include personal
              information (yours or anyone else’s).
            </p>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">Disclaimer</h2>
            <p className="mt-2 text-neutral-700">
              Reviews reflect individual experiences and are not verified facts.
              KnowTheTips is not affiliated with any venue listed.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

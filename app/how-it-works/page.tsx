export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">How KnowTheTips Works</h1>

        <p className="mt-4 text-neutral-700">
          KnowTheTips is an anonymous review platform for <strong>bartenders</strong> and{" "}
          <strong>servers</strong> to share real-world job insights about venues — tips, hours,
          tip pool, busy season, and overall experience.
        </p>

        <div className="mt-8 grid gap-4">
          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">What you can do</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-700">
              <li>Search venues and view aggregated stats</li>
              <li>Submit a bartender/server review (tips, hours, tip pool, etc.)</li>
              <li>Browse reviews to get a clearer picture before applying</li>
              <li>Report a review if it looks suspicious or off-topic</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">Anonymous by design</h2>
            <p className="mt-2 text-neutral-700">
              Reviews are submitted without public profiles. Please don’t include personal info
              (names, phone numbers, screenshots, or anything that could identify you or someone
              else).
            </p>
            <p className="mt-2 text-neutral-700">
              <strong>Note:</strong> To reduce spam, we may add <strong>email verification</strong>{" "}
              for posting reviews in the future. The goal is simple: keep the data cleaner while
              protecting anonymity.
            </p>
          </section>

          <section className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold">Disclaimer</h2>
            <p className="mt-2 text-neutral-700">
              Reviews reflect individual experiences and are not verified facts. KnowTheTips is not
              affiliated with any venue listed.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-black" />
          <span className="text-lg font-semibold tracking-tight">KnowTheTips</span>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-neutral-600 md:flex">
          <a className="hover:text-black" href="#how-it-works">
            How it works
          </a>
          <a className="hover:text-black" href="#why">
            Why this exists
          </a>
          <a className="hover:text-black" href="#faq">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button className="hidden rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50 md:inline-flex">
            Sign in
          </button>
          <button className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900">
            Add a review
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-14 pt-6">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
              Real reviews for bartenders & servers
              <span className="h-1 w-1 rounded-full bg-neutral-400" />
              Tips • Hours • Expectations
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
              Know the tips{" "}
              <span className="text-neutral-400">before</span>{" "}
              you take the job.
            </h1>

            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              Search a bar or restaurant and see what staff actually report:
              average tips, seasonality, tip pool setup, and whether they’d recommend the gig.
            </p>

            {/* Search (UI only for now) */}
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex flex-1 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="text-neutral-400">🔎</span>
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                    placeholder="Search a bar or restaurant (ex: “Friday’s”, “Blue Note”, “The Diner”)"
                  />
                </div>
                <button className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white hover:bg-neutral-900">
                  Search
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 px-1">
                {["Newark", "Jersey City", "Hoboken", "Morristown"].map((city) => (
                  <button
                    key={city}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    {city}
                  </button>
                ))}
              </div>

              <p className="mt-3 px-1 text-xs text-neutral-500">
                Tip reporting note: we’ll label entries as <span className="font-medium">pre-tax</span> or{" "}
                <span className="font-medium">post-tax</span> when users submit earnings.
              </p>
            </div>

            {/* Trust / stats */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">Built for</p>
                <p className="mt-1 text-sm font-semibold">Service Industry</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">Focused on</p>
                <p className="mt-1 text-sm font-semibold">Tips + Reality</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">Start city</p>
                <p className="mt-1 text-sm font-semibold">NJ → NYC</p>
              </div>
            </div>
          </div>

          {/* Right card */}
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Example Venue</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    “Neighborhood Bar” • Newark, NJ
                  </p>
                </div>
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                  Recommended
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat label="Avg Bartender Tips" value="$1,250/wk" />
                <Stat label="Avg Server Tips" value="$900/wk" />
                <Stat label="Tip Pool" value="Yes" />
                <Stat label="Busy Season" value="Summer" />
              </div>

              <div className="mt-5 rounded-2xl border border-neutral-200 p-4">
                <p className="text-xs font-semibold text-neutral-700">Recent review</p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  “Fast-paced on weekends. Tip pool is fair. Management is strict on sidework,
                  but money is solid in season.”
                </p>
                <p className="mt-3 text-xs text-neutral-400">
                  Posted anonymously • Earnings labeled post-tax
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <button className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium hover:bg-neutral-50">
                Browse venues
              </button>
              <button className="rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white hover:bg-neutral-900">
                Submit a review
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Sections */}
      <section id="how-it-works" className="border-t border-neutral-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Feature
              title="Search a venue"
              body="Find bars & restaurants by name and location (Google Places integration next)."
            />
            <Feature
              title="See the real story"
              body="Average tips, seasonality, tip pool setup, hours, and staff ratings."
            />
            <Feature
              title="Add your experience"
              body="Verified email for posting, anonymous display. Pre-tax/post-tax labeling."
            />
          </div>
        </div>
      </section>

      <section id="why" className="border-t border-neutral-100 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Why this exists</h2>
          <p className="mt-4 max-w-3xl text-neutral-600">
            In hospitality, job postings rarely share what matters most: tips, staffing, sidework,
            management, scheduling, and whether the money is real year-round. KnowTheTips exists so
            workers can make informed decisions—before they commit.
          </p>
        </div>
      </section>

      <section id="faq" className="border-t border-neutral-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Faq
              q="Are reviews anonymous?"
              a="Yes. You’ll verify an email to submit (to reduce spam), but the review is displayed anonymously."
            />
            <Faq
              q="How will earnings be reported?"
              a="Users will label earnings as pre-tax or post-tax, and can note tip types (cash/card)."
            />
            <Faq
              q="What cities do you cover?"
              a="We’ll start in a smaller NJ city adjacent to NYC, prove value, then expand into NYC."
            />
            <Faq
              q="Can venues remove reviews?"
              a="No. We’ll moderate for abuse, but honest worker feedback stays."
            />
          </div>
          <p className="mt-8 text-xs text-neutral-500">
            Disclaimer: Tips vary by shift, season, and staffing. This site reflects user-reported estimates.
          </p>
        </div>
      </section>

      <footer className="border-t border-neutral-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-neutral-500">© {new Date().getFullYear()} KnowTheTips</p>
          <div className="flex gap-4 text-sm text-neutral-500">
            <a className="hover:text-black" href="#">
              Privacy
            </a>
            <a className="hover:text-black" href="#">
              Terms
            </a>
            <a className="hover:text-black" href="#">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6">
      <p className="text-sm font-semibold">{q}</p>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{a}</p>
    </div>
  );
}

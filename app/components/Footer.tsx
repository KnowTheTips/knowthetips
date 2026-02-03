export default function Footer() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-neutral-600">
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <div>
            <p>
              KnowTheTips is a community-submitted, anonymous review platform. Tip,
              hours, and venue info are not verified—use as directional guidance
              only.
            </p>

            <p className="mt-3 text-xs text-neutral-500">
              Please don’t post personal information in reviews.
            </p>
          </div>

          <div className="md:text-right">
            <p>
              Contact:{" "}
              <a
                className="underline hover:text-neutral-800"
                href="mailto:info@knowthetips.com"
              >
                info@knowthetips.com
              </a>
            </p>

            <div className="mt-3 flex gap-4 md:justify-end">
              <span className="text-xs text-neutral-500">Privacy</span>
              <span className="text-xs text-neutral-500">Terms</span>
              <span className="text-xs text-neutral-500">Contact</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-neutral-500">© {new Date().getFullYear()} KnowTheTips</p>
      </div>
    </footer>
  );
}

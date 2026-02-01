export default function Footer() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-neutral-600">
        <p>
          KnowTheTips is a community-submitted, anonymous review platform. Tip,
          hours, and venue info are not verified—use as directional guidance
          only.
        </p>

        <p className="mt-3">
          Contact:{" "}
          <a
            className="underline hover:text-neutral-800"
            href="mailto:info@knowthetips.com"
          >
            contact@knowthetips.com
          </a>
        </p>

        <p className="mt-3 text-xs text-neutral-500">
          Please don’t post personal information in reviews.
        </p>
      </div>
    </footer>
  );
}

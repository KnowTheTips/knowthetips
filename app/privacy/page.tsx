export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>

        <p className="mt-6 text-neutral-700">
          KnowTheTips does not require users to create accounts or provide
          personal information to submit reviews.
        </p>

        <p className="mt-4 text-neutral-700">
          All reviews are submitted anonymously. We do not sell, rent, or share
          personal data with third parties.
        </p>

        <p className="mt-4 text-neutral-700">
          Basic technical data (such as IP address or browser type) may be
          processed by our hosting and analytics providers for security and
          performance purposes.
        </p>

        <p className="mt-4 text-neutral-700">
          If you believe content on this site violates your privacy, please
          contact us at{" "}
          <a
            href="mailto:info@knowthetips.com"
            className="underline hover:text-neutral-900"
          >
            info@knowthetips.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}

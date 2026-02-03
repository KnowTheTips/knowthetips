export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Contact</h1>

        <p className="mt-6 text-neutral-700">
          For general questions, corrections, takedown requests, or press
          inquiries, you can reach us at:
        </p>

        <p className="mt-4 text-lg font-medium">
          <a
            href="mailto:info@knowthetips.com"
            className="underline hover:text-neutral-900"
          >
            info@knowthetips.com
          </a>
        </p>

        <p className="mt-6 text-sm text-neutral-500">
          Please note: reviews are anonymous and cannot be edited once submitted.
        </p>
      </div>
    </main>
  );
}

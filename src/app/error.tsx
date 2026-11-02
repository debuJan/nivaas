"use client";

// Root error boundary: any page under this segment that fails to load
// lands here with a way back, instead of a dead screen.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-5 py-10 text-center">
      <p className="text-4xl">🌧️</p>
      <h1 className="mt-3 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 text-sm text-stone-500">
        This screen could not be loaded. Your data is safe — please try
        again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 min-h-11 rounded-xl bg-accent px-5 py-3 font-medium text-white transition hover:bg-accent-dark"
      >
        Try again
      </button>
    </main>
  );
}

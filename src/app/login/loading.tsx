export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-stone-200/70" />
      <div className="mt-8 h-48 animate-pulse rounded-2xl bg-stone-200/70" />
      <div className="mt-5 h-32 animate-pulse rounded-2xl bg-stone-200/70" />
    </main>
  );
}

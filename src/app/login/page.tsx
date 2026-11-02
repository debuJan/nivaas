"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DEMO_LOGINS = [
  { label: "Resident — Neeraj Kulkarni (T07-1203)", phone: "9820011100" },
  { label: "Resident — Swati Joshi, tenant (T12-0408)", phone: "9820011104" },
  { label: "Help desk — Priya Nair", phone: "9000000001" },
  { label: "Committee — R. Menon", phone: "9000000002" },
];

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(p: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the code.");
      setPhone(p);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      router.push(data.home ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-accent">
        Nivaas
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Maintenance, complaints and community — for residents of the township.
      </p>

      <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        {step === "phone" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void requestOtp(phone);
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium text-stone-700">
                Mobile number
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                placeholder="10-digit mobile number"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-stone-300 px-3 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-teal-100"
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || phone.length !== 10}
              className="min-h-11 w-full rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-stone-600">
              Code sent to <span className="font-medium">{phone}</span>.{" "}
              <button
                type="button"
                className="text-accent underline"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
              >
                Change number
              </button>
            </p>
            <div>
              <label className="text-sm font-medium text-stone-700">
                6-digit code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="••••••"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-stone-300 px-3 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-accent focus:ring-2 focus:ring-teal-100"
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="min-h-11 w-full rounded-xl bg-accent py-3 font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
          </form>
        )}
      </div>

      <div className="mt-5 rounded-2xl bg-teal-50 p-4 text-sm ring-1 ring-teal-100">
        <p className="font-medium text-teal-900">Demo logins</p>
        <p className="mt-0.5 text-teal-800">
          OTP is mocked in this build — use <strong>123456</strong> for any of
          these registered numbers:
        </p>
        <ul className="mt-2 space-y-1.5">
          {DEMO_LOGINS.map((d) => (
            <li key={d.phone} className="flex items-center justify-between gap-2">
              <span className="text-teal-900">{d.label}</span>
              <button
                type="button"
                onClick={() => void requestOtp(d.phone)}
                className="min-h-11 shrink-0 rounded-lg bg-white px-3 py-1 font-mono text-xs text-accent ring-1 ring-teal-200 transition hover:bg-teal-100"
              >
                {d.phone}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

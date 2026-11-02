"use client";

import Link from "next/link";
import { useState } from "react";

interface Flat {
  id: string;
  code: string;
}

interface AiVerdict {
  category: string;
  urgency: string;
  confidence: number;
  escalated: boolean;
  duplicateOfId: string | null;
}

export function ComplaintForm({ flats }: { flats: Flat[] }) {
  const [flatId, setFlatId] = useState(flats[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiVerdict | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("flatId", flatId);
      form.set("title", title);
      form.set("description", description);
      if (photo) form.set("photo", photo);
      const res = await fetch("/api/complaints", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not raise the complaint.");
      setAi(data.ai);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (ai) {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <p className="text-3xl">✅</p>
        <h3 className="mt-2 text-lg font-semibold">Complaint raised</h3>
        <p className="mt-1 text-sm text-stone-600">
          Our system read your complaint and filed it as:
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Category</dt>
            <dd className="font-medium">{ai.category}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Urgency</dt>
            <dd className={`font-medium ${ai.urgency === "CRITICAL" ? "text-rose-600" : ""}`}>
              {ai.urgency}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">AI confidence</dt>
            <dd className="font-medium">{Math.round(ai.confidence * 100)}%</dd>
          </div>
        </dl>
        {ai.confidence < 0.5 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            The system was not sure of the category, so the help desk will
            confirm it — your complaint is not delayed by this.
          </p>
        )}
        {ai.escalated && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
            ⚠ This mentions a safety issue, so it has been escalated to the
            duty manager immediately, whatever the category.
          </p>
        )}
        {ai.duplicateOfId && (
          <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-800 ring-1 ring-indigo-200">
            This looks like the same issue a neighbour already reported, so
            the two are linked — the team sees it as one bigger incident.
          </p>
        )}
        <Link
          href="/complaints"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 py-3 font-medium text-white hover:bg-accent-dark"
        >
          Track my complaints
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200"
    >
      <div>
        <label className="text-sm font-medium text-stone-700">Flat</label>
        <select
          value={flatId}
          onChange={(e) => setFlatId(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-accent"
        >
          {flats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-stone-700">
          What is the problem?
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Water leak in bathroom"
          className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-stone-700">Details</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Where, since when, how bad — a line or two helps the team."
          className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-stone-700">
          Photo (optional)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="mt-1.5 block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-medium file:text-accent"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={busy || title.trim().length < 3 || description.trim().length < 5}
        className="min-h-11 w-full rounded-xl bg-accent py-3 font-medium text-white hover:bg-accent-dark disabled:opacity-50"
      >
        {busy ? "Raising…" : "Raise complaint"}
      </button>
      <p className="text-xs text-stone-400">
        The category and urgency are picked automatically and shown to you —
        the help desk can correct them in one tap if they look wrong.
      </p>
    </form>
  );
}

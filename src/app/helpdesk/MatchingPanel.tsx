"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR } from "@/lib/format";
import { PaymentStatusChip } from "@/components/chips";

interface VerdictRow {
  date?: string;
  narration?: string;
  reference?: string | null;
  upiId?: string | null;
  amount?: number;
}
interface Verdict {
  row: VerdictRow;
  verdict: "POSTED" | "QUEUED";
  flatCode?: string;
  tier: number;
  reason: string;
  partial?: boolean;
}
interface QueueItem {
  id: string;
  amount: number;
  reference: string;
  payerUpiId: string | null;
  createdAt: string;
  rawRow: Record<string, string> | null;
}
interface FlatOption {
  id: string;
  code: string;
  openDue: number;
}

export function MatchingPanel() {
  const [csv, setCsv] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[] | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [flats, setFlats] = useState<FlatOption[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    const [q, f] = await Promise.all([
      fetch("/api/helpdesk/queue").then((r) => r.json()),
      fetch("/api/helpdesk/flats").then((r) => r.json()),
    ]);
    setQueue(q.queue ?? []);
    setFlats(f.flats ?? []);
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function useSample() {
    const text = await fetch("/sample-bank-statement.csv").then((r) => r.text());
    setCsv(text);
  }

  async function onFile(file: File) {
    setCsv(await file.text());
  }

  async function run() {
    setRunning(true);
    setError(null);
    setVerdicts(null);
    try {
      const res = await fetch("/api/helpdesk/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Matching failed.");
      setVerdicts(data.verdicts);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Matching failed.");
    } finally {
      setRunning(false);
    }
  }

  async function resolve(id: string, action: "POST_TO_FLAT" | "REJECT") {
    const body: Record<string, string> = { action };
    if (action === "POST_TO_FLAT") {
      const flatId = chosen[id] ?? flats[0]?.id;
      if (!flatId) return;
      body.flatId = flatId;
    }
    const res = await fetch(`/api/helpdesk/queue/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await loadQueue();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not resolve that entry.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <h3 className="font-semibold">Bank statement matching</h3>
        <p className="mt-0.5 text-sm text-stone-500">
          Upload or paste the society account statement (CSV). Rows the
          engine can prove are posted; everything unclear waits in the
          accounts queue below — never on a flat by guesswork.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg bg-teal-50 px-3 py-2.5 text-sm font-medium text-accent ring-1 ring-teal-200 hover:bg-teal-100">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void useSample()}
            className="rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
          >
            Use sample CSV
          </button>
          <button
            type="button"
            disabled={running || !csv.trim()}
            onClick={() => void run()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {running ? "Matching…" : "Run matching"}
          </button>
        </div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={7}
          placeholder={"date,narration,reference,upiId,amount\n2026-11-04,UPI/…,…"}
          className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

        {verdicts && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-sm font-medium">
              {verdicts.filter((v) => v.verdict === "POSTED").length} posted ·{" "}
              {verdicts.filter((v) => v.verdict === "QUEUED").length} queued
            </p>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
                  <th className="py-2 pr-3 font-medium">Narration</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Verdict</th>
                  <th className="py-2 font-medium">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {verdicts.map((v, i) => (
                  <tr key={i}>
                    <td className="max-w-xs py-2 pr-3">
                      <p className="truncate">{v.row.narration ?? "—"}</p>
                      <p className="text-xs text-stone-400">
                        {v.row.upiId ?? v.row.reference ?? ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 font-medium">
                      {v.row.amount != null ? formatINR(v.row.amount) : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <PaymentStatusChip status={v.verdict} />
                      {(v.flatCode || v.partial) && (
                        <span className="ml-1.5 text-xs text-stone-500">
                          {v.flatCode ? `→ ${v.flatCode}` : ""}
                          {v.partial ? " (part payment)" : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-stone-500">
                      <span className="text-xs text-stone-400">Tier {v.tier} · </span>
                      {v.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Accounts queue — needs a human</h3>
        {queue === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-stone-200/70" />
        ) : queue.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">
            Queue is empty — every payment is placed. 🎉
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
              >
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{formatINR(q.amount)}</p>
                  <p className="text-xs text-stone-500">
                    {String(q.rawRow?.narration ?? q.rawRow?.description ?? "Bank transfer")}
                    {q.payerUpiId ? ` · UPI ${q.payerUpiId}` : ""} · Ref{" "}
                    {q.reference}
                  </p>
                </div>
                <select
                  value={chosen[q.id] ?? flats[0]?.id ?? ""}
                  onChange={(e) =>
                    setChosen((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  className="rounded-lg border border-stone-200 bg-white px-2 py-2.5 text-sm outline-none focus:border-accent"
                  aria-label="Post to flat"
                >
                  {flats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} (due {formatINR(f.openDue)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void resolve(q.id, "POST_TO_FLAT")}
                  className="rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white hover:bg-accent-dark"
                >
                  Post to flat
                </button>
                <button
                  type="button"
                  onClick={() => void resolve(q.id, "REJECT")}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50"
                >
                  Reject
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

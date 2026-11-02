"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate, ageLabel } from "@/lib/format";
import { ComplaintStatusChip, UrgencyChip } from "@/components/chips";

interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  assignedTeam: string | null;
  aiConfidence: number | null;
  createdAt: string;
  flat: { code: string; tower: string };
  raisedBy: { name: string };
  duplicateOf: { id: string; title: string } | null;
  _count: { duplicates: number };
}

const CATEGORIES = [
  "PLUMBING", "ELECTRICAL", "LIFT", "CARPENTRY", "HOUSEKEEPING", "SECURITY", "OTHER",
];
const STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const TEAMS = [
  "Plumbing", "Electrical", "Lift Maintenance", "Carpentry",
  "Housekeeping", "Security", "General",
];

const selectCls =
  "rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-accent";

export function ComplaintsBoard() {
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/helpdesk/complaints");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load complaints.");
      setComplaints(data.complaints);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load complaints.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, body: Record<string, string>) {
    const res = await fetch(`/api/helpdesk/complaints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) void load();
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <p className="text-sm text-rose-600">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!complaints) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-200/70" />
        ))}
      </div>
    );
  }
  if (complaints.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-5 text-sm text-stone-500 ring-1 ring-stone-200">
        No complaints in the township yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3 font-medium">Complaint</th>
            <th className="px-4 py-3 font-medium">Flat</th>
            <th className="px-4 py-3 font-medium">Age</th>
            <th className="px-4 py-3 font-medium">Urgency</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {complaints.map((c) => (
            <tr
              key={c.id}
              className={`align-top transition ${
                c.urgency === "CRITICAL"
                  ? "bg-rose-50/70"
                  : "hover:bg-stone-50"
              }`}
            >
              <td className="max-w-xs px-4 py-3">
                <p className="font-medium">{c.title}</p>
                <p className="line-clamp-2 text-xs text-stone-500">{c.description}</p>
                <p className="mt-0.5 text-xs text-stone-400">
                  by {c.raisedBy.name} · {formatDate(c.createdAt)}
                  {c.aiConfidence != null &&
                    ` · AI ${Math.round(c.aiConfidence * 100)}%`}
                </p>
                {c.duplicateOf && (
                  <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                    Duplicate of “{c.duplicateOf.title}”
                  </span>
                )}
                {c._count.duplicates > 0 && (
                  <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                    +{c._count.duplicates} linked
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-medium">{c.flat.code}</td>
              <td className="whitespace-nowrap px-4 py-3 text-stone-500">
                {ageLabel(c.createdAt)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <UrgencyChip urgency={c.urgency} />
              </td>
              <td className="px-4 py-3">
                <select
                  value={c.category}
                  onChange={(e) => void patch(c.id, { category: e.target.value })}
                  className={selectCls}
                  aria-label="Category"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <select
                  value={TEAMS.find((t) => (c.assignedTeam ?? "").startsWith(t)) ?? ""}
                  onChange={(e) =>
                    e.target.value &&
                    void patch(c.id, { assignedTeam: e.target.value })
                  }
                  className={selectCls}
                  aria-label="Team"
                >
                  <option value="">{c.assignedTeam ?? "Unassigned"}</option>
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <select
                    value={c.status}
                    onChange={(e) => void patch(c.id, { status: e.target.value })}
                    className={selectCls}
                    aria-label="Status"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                  <ComplaintStatusChip status={c.status} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

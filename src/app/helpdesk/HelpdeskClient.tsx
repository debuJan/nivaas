"use client";

import { useState } from "react";
import { ComplaintsBoard } from "./ComplaintsBoard";
import { MatchingPanel } from "./MatchingPanel";

export function HelpdeskClient() {
  const [tab, setTab] = useState<"complaints" | "matching">("complaints");
  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-2xl bg-white p-1 ring-1 ring-stone-200">
        {(
          [
            { id: "complaints", label: "Complaints board" },
            { id: "matching", label: "Bank matching & queue" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-accent text-white"
                : "text-stone-500 hover:bg-stone-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "complaints" ? <ComplaintsBoard /> : <MatchingPanel />}
    </div>
  );
}

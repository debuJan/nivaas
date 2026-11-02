"use client";

import { useState } from "react";
import { ComplaintsBoard } from "./ComplaintsBoard";
import { MatchingPanel } from "./MatchingPanel";

export function HelpdeskClient() {
  const [tab, setTab] = useState<"complaints" | "matching">("complaints");
  return (
    <div>
      {/* Sticky tab bar: staff switch between the board and matching
          without scrolling back to the top of a long table. */}
      <div className="sticky top-0 z-10 -mt-5 mb-5 bg-stone-50/95 pt-5 backdrop-blur">
        <div className="flex gap-1 rounded-2xl bg-white p-1 ring-1 ring-stone-200">
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
              className={`min-h-11 flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-accent text-white"
                  : "text-stone-500 hover:bg-stone-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "complaints" ? <ComplaintsBoard /> : <MatchingPanel />}
    </div>
  );
}

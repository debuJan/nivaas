"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatINR, formatMonth } from "@/lib/format";

interface Receipt {
  paymentId: string;
  amount: number;
  reference: string;
  method: string;
  flatCode: string;
  month: string;
  date: string;
}

export function PayButton({
  billId,
  dueAmount,
  month,
}: {
  billId: string;
  dueAmount: number;
  month: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"UPI" | "CARD">("UPI");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bills/${billId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed.");
      setReceipt(data.receipt);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-dark"
      >
        Pay {formatINR(dueAmount)}
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
            {receipt ? (
              <div className="text-center">
                <p className="text-4xl">✅</p>
                <h3 className="mt-2 text-lg font-semibold">Payment successful</h3>
                <dl className="mt-4 space-y-1.5 text-left text-sm">
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Amount</dt>
                    <dd className="font-medium">{formatINR(receipt.amount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Flat</dt>
                    <dd className="font-medium">{receipt.flatCode}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Bill</dt>
                    <dd className="font-medium">{formatMonth(receipt.month)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Method</dt>
                    <dd className="font-medium">{receipt.method} (test mode)</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Reference</dt>
                    <dd className="font-mono text-xs">{receipt.reference}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setReceipt(null);
                  }}
                  className="mt-5 min-h-11 w-full rounded-xl bg-accent py-3 font-medium text-white hover:bg-accent-dark"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold">
                  Pay {formatINR(dueAmount)}
                </h3>
                <p className="mt-0.5 text-sm text-stone-500">
                  {formatMonth(month)} maintenance · test-mode gateway, no
                  real money moves.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(["UPI", "CARD"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`rounded-xl border px-4 py-3 font-medium transition ${
                        method === m
                          ? "border-accent bg-teal-50 text-accent"
                          : "border-stone-200 text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      {m === "UPI" ? "UPI" : "Card"}
                    </button>
                  ))}
                </div>
                {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-11 flex-1 rounded-xl border border-stone-200 py-3 font-medium text-stone-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void pay()}
                    className="min-h-11 flex-1 rounded-xl bg-accent py-3 font-medium text-white hover:bg-accent-dark disabled:opacity-50"
                  >
                    {busy ? "Processing…" : `Pay ${formatINR(dueAmount)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

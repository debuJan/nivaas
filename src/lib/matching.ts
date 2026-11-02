/**
 * Bank-statement payment matching engine.
 *
 * The society receives one bank CSV for the whole township. Each row must be
 * credited to exactly one flat's bill — or not credited at all. Money safety
 * beats automation coverage, so the rule is strict:
 *
 *   A row is POSTED only when the evidence identifies ONE flat beyond doubt.
 *   Anything weaker goes to the accounts QUEUE for a human. In particular,
 *   an amount-only match is NEVER posted automatically: in a township of
 *   2,400 flats, dozens of bills share the same amount every month.
 *
 * This is a pure function (no DB, no I/O) so it can be unit-tested exactly
 * and reused from the import API route later.
 */

export interface BankRow {
  date: string; // "2026-11-04"
  narration: string; // free-text bank narration, may contain a flat code
  reference?: string | null; // UTR / cheque / gateway reference
  upiId?: string | null; // payer UPI id, when the bank provides it
  amount: number; // rupees, as credited in the statement
}

export interface OpenBill {
  billId: string;
  flatCode: string; // "T07-1203"
  /** Remaining amount due (base + lateFee - already paid). */
  dueAmount: number;
  /** A reference the resident was asked to quote (e.g. from a payment link). */
  reference?: string | null;
}

export interface Reservation {
  reference: string;
  flatCode: string;
  billId: string;
}

export interface MatchInput {
  rows: BankRow[];
  /** Open bills only (UNPAID / PARTIALLY_PAID), oldest first. */
  bills: OpenBill[];
  /** payer UPI id (lowercase) -> flat code */
  upiToFlat: Record<string, string>;
  /** References pre-registered against a bill (payment links, cheques). */
  reservations?: Reservation[];
}

export interface Verdict {
  row: BankRow;
  verdict: "POSTED" | "QUEUED";
  flatCode?: string;
  billId?: string;
  /** 1 (strongest) .. 6 — which rule decided this row. */
  tier: number;
  reason: string;
  /** True when the row covers only part of the bill's due. */
  partial?: boolean;
}

const normRef = (r?: string | null) => (r ?? "").trim().toUpperCase();
const normUpi = (u?: string | null) => (u ?? "").trim().toLowerCase();

/** Find flat codes like "T07-1203" or "T7 1203" inside a narration. */
export function flatCodesInNarration(narration: string): string[] {
  const found = new Set<string>();
  const re = /\bT(\d{1,2})[-\s]?(\d{3,4})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(narration)) !== null) {
    const tower = m[1].padStart(2, "0");
    const flat = m[2].padStart(4, "0");
    found.add(`T${tower}-${flat}`);
  }
  return [...found];
}

export function matchPayments(input: MatchInput): Verdict[] {
  const { rows, upiToFlat, reservations = [] } = input;

  // Working copy of what is still owed per bill. POSTED rows reduce it, so
  // one bill can never be credited twice inside the same statement.
  const remaining = new Map<string, number>();
  const billById = new Map<string, OpenBill>();
  for (const b of input.bills) {
    remaining.set(b.billId, b.dueAmount);
    billById.set(b.billId, b);
  }
  const openBillForFlat = (flatCode: string) =>
    input.bills.find(
      (b) => b.flatCode === flatCode && (remaining.get(b.billId) ?? 0) > 0,
    );

  const reservationByRef = new Map<string, Reservation>();
  for (const r of reservations) reservationByRef.set(normRef(r.reference), r);
  const billByRef = new Map<string, OpenBill>();
  for (const b of input.bills) {
    if (b.reference) billByRef.set(normRef(b.reference), b);
  }

  const post = (
    row: BankRow,
    bill: OpenBill,
    tier: number,
    reason: string,
  ): Verdict => {
    const due = remaining.get(bill.billId) ?? 0;
    const partial = row.amount < due;
    remaining.set(bill.billId, Math.max(0, due - row.amount));
    return {
      row,
      verdict: "POSTED",
      flatCode: bill.flatCode,
      billId: bill.billId,
      tier,
      reason,
      partial,
    };
  };
  const queue = (row: BankRow, tier: number, reason: string): Verdict => ({
    row,
    verdict: "QUEUED",
    tier,
    reason,
  });

  return rows.map((row) => {
    // ── Tier 1: exact reference / UTR match ──────────────────────────────
    const ref = normRef(row.reference);
    if (ref) {
      const res = reservationByRef.get(ref);
      const bill = res
        ? billById.get(res.billId)
        : billByRef.get(ref);
      if (bill) {
        if ((remaining.get(bill.billId) ?? 0) <= 0) {
          return queue(row, 1, `Reference ${ref} matches ${bill.flatCode} but its bill is already settled in this statement`);
        }
        return post(row, bill, 1, `Reference ${ref} is registered to ${bill.flatCode}`);
      }
    }

    // ── Tiers 2–3: payer UPI id identifies the flat ──────────────────────
    const flatCode = upiToFlat[normUpi(row.upiId)];
    if (flatCode) {
      const bill = openBillForFlat(flatCode);
      if (bill) {
        const due = remaining.get(bill.billId) ?? 0;
        if (row.amount === due) {
          return post(row, bill, 2, `UPI id belongs to ${flatCode} and amount equals the full due`);
        }
        if (row.amount < due) {
          return post(row, bill, 3, `UPI id belongs to ${flatCode}; amount is a part-payment of the due`);
        }
        return queue(row, 6, `UPI id belongs to ${flatCode} but the amount is more than the due — overpayment needs a human`);
      }
      return queue(row, 6, `UPI id belongs to ${flatCode} but the flat has no open bill`);
    }

    // ── Tier 4: flat code in the narration, exact amount, one candidate ─
    const codes = flatCodesInNarration(row.narration);
    if (codes.length === 1) {
      const bill = openBillForFlat(codes[0]);
      if (bill && row.amount === (remaining.get(bill.billId) ?? 0)) {
        return post(row, bill, 4, `Narration names ${codes[0]} and the amount equals its due exactly`);
      }
    }

    // ── Tiers 5–6: amount alone is never enough to post ─────────────────
    const amountMatches = input.bills.filter(
      (b) => (remaining.get(b.billId) ?? 0) === row.amount,
    );
    if (amountMatches.length === 1) {
      return queue(row, 5, `Amount equals the due of ${amountMatches[0].flatCode} only, but an amount alone never auto-posts`);
    }
    if (amountMatches.length > 1) {
      return queue(row, 6, `Amount matches ${amountMatches.length} open bills (${amountMatches.map((b) => b.flatCode).join(", ")}) — ambiguous`);
    }
    if (codes.length > 1) {
      return queue(row, 6, `Narration names more than one flat (${codes.join(", ")})`);
    }
    return queue(row, 6, "No reference, UPI, flat-code or unique-amount signal — cannot identify the flat safely");
  });
}

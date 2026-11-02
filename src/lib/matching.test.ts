import { describe, expect, it } from "vitest";
import {
  matchPayments,
  type BankRow,
  type MatchInput,
  type OpenBill,
} from "./matching";

// Fixture mirrors the seed data: Neeraj (T07-1203) owes 7475,
// Swati (T12-0408) owes 6370 + 96 late fee = 6466,
// Aamir (T21-1601) has 5660 left after a part-payment.
const bills: OpenBill[] = [
  { billId: "b-neeraj", flatCode: "T07-1203", dueAmount: 7475, reference: "NIV-T07-1203-202611" },
  { billId: "b-swati", flatCode: "T12-0408", dueAmount: 6466 },
  { billId: "b-aamir", flatCode: "T21-1601", dueAmount: 5660 },
  { billId: "b-nilesh", flatCode: "T03-0702", dueAmount: 6825 },
  { billId: "b-geeta", flatCode: "T18-1502", dueAmount: 6825 },
  { billId: "b-prakash", flatCode: "T21-0101", dueAmount: 5850 },
];

const base = (rows: BankRow[]): MatchInput => ({
  rows,
  bills: bills.map((b) => ({ ...b })),
  upiToFlat: { "swati.joshi@okhdfc": "T12-0408" },
  reservations: [{ reference: "UTR998877", flatCode: "T21-1601", billId: "b-aamir" }],
});

const row = (partial: Partial<BankRow>): BankRow => ({
  date: "2026-11-04",
  narration: "UPI CREDIT",
  amount: 0,
  ...partial,
});

describe("matchPayments", () => {
  it("tier 1: exact reference match posts to the registered bill", () => {
    const [v] = matchPayments(base([row({ amount: 7475, reference: "niv-t07-1203-202611" })]));
    expect(v.verdict).toBe("POSTED");
    expect(v.tier).toBe(1);
    expect(v.flatCode).toBe("T07-1203");
    expect(v.billId).toBe("b-neeraj");
  });

  it("tier 1: a pre-registered UTR reservation posts even without other signals", () => {
    const [v] = matchPayments(base([row({ amount: 5660, reference: "UTR998877" })]));
    expect(v.verdict).toBe("POSTED");
    expect(v.tier).toBe(1);
    expect(v.flatCode).toBe("T21-1601");
  });

  it("tier 2: UPI id + full due amount posts", () => {
    const [v] = matchPayments(base([row({ amount: 6466, upiId: "Swati.Joshi@okhdfc" })]));
    expect(v.verdict).toBe("POSTED");
    expect(v.tier).toBe(2);
    expect(v.partial).toBe(false);
  });

  it("tier 3: UPI id + smaller amount posts as a part-payment", () => {
    const [v] = matchPayments(base([row({ amount: 3000, upiId: "swati.joshi@okhdfc" })]));
    expect(v.verdict).toBe("POSTED");
    expect(v.tier).toBe(3);
    expect(v.partial).toBe(true);
    expect(v.flatCode).toBe("T12-0408");
  });

  it("tier 4: flat code in narration + exact amount posts", () => {
    const [v] = matchPayments(
      base([row({ amount: 5660, narration: "IMPS/MAINT/T21-1601/NOV" })]),
    );
    expect(v.verdict).toBe("POSTED");
    expect(v.tier).toBe(4);
    expect(v.flatCode).toBe("T21-1601");
  });

  it("tier 5: amount-only match is QUEUED — never auto-posted", () => {
    const [v] = matchPayments(base([row({ amount: 5850, narration: "NEFT TRANSFER" })]));
    expect(v.verdict).toBe("QUEUED");
    expect(v.tier).toBe(5);
  });

  it("tier 6: an amount shared by two flats is ambiguous — QUEUED", () => {
    const [v] = matchPayments(base([row({ amount: 6825, narration: "UPI CREDIT" })]));
    expect(v.verdict).toBe("QUEUED");
    expect(v.tier).toBe(6);
    expect(v.reason).toContain("ambiguous");
  });

  it("tier 6: a row with no usable signal is QUEUED", () => {
    const [v] = matchPayments(base([row({ amount: 1234, narration: "CASH DEPOSIT" })]));
    expect(v.verdict).toBe("QUEUED");
    expect(v.tier).toBe(6);
  });

  it("tier 6: UPI overpayment is QUEUED for a human, not posted", () => {
    const [v] = matchPayments(base([row({ amount: 9000, upiId: "swati.joshi@okhdfc" })]));
    expect(v.verdict).toBe("QUEUED");
    expect(v.reason).toContain("more than the due");
  });

  it("never credits one bill twice inside a single statement", () => {
    const vs = matchPayments(
      base([
        row({ amount: 6466, upiId: "swati.joshi@okhdfc" }),
        row({ amount: 6466, upiId: "swati.joshi@okhdfc" }),
      ]),
    );
    expect(vs[0].verdict).toBe("POSTED");
    expect(vs[1].verdict).toBe("QUEUED");
  });
});

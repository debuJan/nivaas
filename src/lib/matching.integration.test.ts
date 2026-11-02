import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseBankCsv } from "./csv";
import { matchPayments, type OpenBill } from "./matching";

/**
 * Integration check: the sample statement shipped in /public, run against
 * open-bill fixtures that mirror the seed (same flats, same dues).
 * Expected mix: 3 POSTED (tiers 2, 4, 3) and 3 QUEUED (tiers 6, 5, 6) —
 * if the seed's dues change, this test and the CSV must change together.
 */
const csvText = readFileSync(
  path.join(process.cwd(), "public", "sample-bank-statement.csv"),
  "utf8",
);

const bills: OpenBill[] = [
  { billId: "swati-oct", flatCode: "T12-0408", dueAmount: 6466 },
  { billId: "imran-oct", flatCode: "T03-0303", dueAmount: 6268 },
  { billId: "sanjay-oct", flatCode: "T18-0402", dueAmount: 9237 },
  { billId: "swati-nov", flatCode: "T12-0408", dueAmount: 6370 },
  { billId: "meera-nov", flatCode: "T07-1404", dueAmount: 7150 },
  { billId: "deepa-nov", flatCode: "T12-0201", dueAmount: 7150 },
  { billId: "imran-nov", flatCode: "T03-0303", dueAmount: 6175 },
  { billId: "pooja-nov", flatCode: "T18-0903", dueAmount: 6500 },
  { billId: "sunita-nov", flatCode: "T21-1203", dueAmount: 8125 },
  { billId: "aamir-nov", flatCode: "T21-1601", dueAmount: 5660 },
];

const upiToFlat = {
  "swati.joshi@okhdfc": "T12-0408",
  "aamir.shaikh@okhdfc": "T21-1601",
};

describe("sample bank statement verdict mix", () => {
  const { rows, errors } = parseBankCsv(csvText);
  const verdicts = matchPayments({ rows, bills, upiToFlat });

  it("parses all six rows cleanly", () => {
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(6);
  });

  it("posts Swati's UPI payment to her October bill (tier 2)", () => {
    expect(verdicts[0]).toMatchObject({
      verdict: "POSTED",
      tier: 2,
      flatCode: "T12-0408",
      billId: "swati-oct",
    });
  });

  it("queues the ambiguous ₹7,150 — two flats owe exactly that (tier 6)", () => {
    expect(verdicts[1]).toMatchObject({ verdict: "QUEUED", tier: 6 });
  });

  it("posts the narration flat-code row to T07-1404 (tier 4)", () => {
    expect(verdicts[2]).toMatchObject({
      verdict: "POSTED",
      tier: 4,
      flatCode: "T07-1404",
      billId: "meera-nov",
    });
  });

  it("posts Aamir's part payment (tier 3, partial)", () => {
    expect(verdicts[3]).toMatchObject({
      verdict: "POSTED",
      tier: 3,
      flatCode: "T21-1601",
      partial: true,
    });
  });

  it("queues the amount-only ₹8,125 — an amount alone never posts (tier 5)", () => {
    expect(verdicts[4]).toMatchObject({ verdict: "QUEUED", tier: 5 });
  });

  it("queues the unknown cheque deposit (tier 6)", () => {
    expect(verdicts[5]).toMatchObject({ verdict: "QUEUED", tier: 6 });
  });

  it("totals 3 posted and 3 queued", () => {
    expect(verdicts.filter((v) => v.verdict === "POSTED")).toHaveLength(3);
    expect(verdicts.filter((v) => v.verdict === "QUEUED")).toHaveLength(3);
  });
});

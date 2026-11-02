import { describe, expect, it } from "vitest";
import { parseBankCsv } from "./csv";

describe("parseBankCsv", () => {
  it("parses a standard statement", () => {
    const { rows, errors } = parseBankCsv(
      "date,narration,reference,upiId,amount\n" +
        "2026-11-04,UPI/NEERAJ/MAINT,UTR1,neeraj.k@okhdfc,7475\n",
    );
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      date: "2026-11-04",
      narration: "UPI/NEERAJ/MAINT",
      reference: "UTR1",
      upiId: "neeraj.k@okhdfc",
      amount: 7475,
    });
  });

  it("tolerates missing optional columns", () => {
    const { rows } = parseBankCsv(
      "date,narration,amount\n2026-11-04,NEFT TRANSFER,7150\n",
    );
    expect(rows[0].reference).toBeNull();
    expect(rows[0].upiId).toBeNull();
    expect(rows[0].amount).toBe(7150);
  });

  it("accepts header aliases and Indian-formatted amounts", () => {
    const { rows } = parseBankCsv(
      'Date,Description,Credit\n2026-11-04,"UPI, part payment","6,466.00"\n',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].narration).toBe("UPI, part payment");
    expect(rows[0].amount).toBe(6466);
  });

  it("reports rows with a bad amount instead of dropping them", () => {
    const { rows, errors } = parseBankCsv(
      "date,narration,amount\n2026-11-04,BROKEN ROW,not-a-number\n",
    );
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/not a positive number/);
  });

  it("skips blank lines and an empty file", () => {
    expect(parseBankCsv("").rows).toHaveLength(0);
    const { rows } = parseBankCsv(
      "date,narration,amount\n\n2026-11-04,X,100\n\n",
    );
    expect(rows).toHaveLength(1);
  });
});

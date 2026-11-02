/**
 * Tolerant CSV parsing for bank statements.
 *
 * Bank exports vary: optional columns go missing, headers change case,
 * amounts arrive as "6,466.00" or " 6466 ". The parser normalises what it
 * can and reports rows it cannot — a malformed row must land in the
 * accounts queue with an explanation, never silently vanish.
 */
import type { BankRow } from "./matching";

export interface ParsedRow extends BankRow {
  /** The original cells, kept for the audit trail (Payment.rawRow). */
  raw: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Rows that could not be turned into a BankRow, with the reason. */
  errors: Array<{ raw: Record<string, string>; reason: string }>;
}

/** Split one CSV line, honouring double-quoted cells. */
function splitLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  narration: "narration",
  description: "narration",
  particulars: "narration",
  reference: "reference",
  ref: "reference",
  utr: "reference",
  "cheque no": "reference",
  upiid: "upiId",
  "upi id": "upiId",
  upi: "upiId",
  amount: "amount",
  credit: "amount",
  "credit amount": "amount",
};

export function parseBankCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: ParsedRow[] = [];
  const errors: ParseResult["errors"] = [];
  if (lines.length === 0) return { rows, errors };

  const headerCells = splitLine(lines[0]).map((h) => h.toLowerCase());
  const colIndex = new Map<string, number>();
  headerCells.forEach((h, i) => {
    const canonical = HEADER_ALIASES[h];
    if (canonical && !colIndex.has(canonical)) colIndex.set(canonical, i);
  });
  const get = (cells: string[], field: string): string => {
    const i = colIndex.get(field);
    return i === undefined ? "" : (cells[i] ?? "");
  };

  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    const raw: Record<string, string> = {};
    headerCells.forEach((h, i) => {
      raw[h] = cells[i] ?? "";
    });
    const amountText = get(cells, "amount").replace(/[₹,\s]/g, "");
    const amount = Number(amountText);
    if (!amountText || !Number.isFinite(amount) || amount <= 0) {
      errors.push({ raw, reason: `Amount "${get(cells, "amount")}" is not a positive number` });
      continue;
    }
    const orNull = (v: string) => (v.trim() ? v.trim() : null);
    rows.push({
      date: get(cells, "date"),
      narration: get(cells, "narration"),
      reference: orNull(get(cells, "reference")),
      upiId: orNull(get(cells, "upiId")),
      amount: Math.round(amount),
      raw,
    });
  }
  return { rows, errors };
}

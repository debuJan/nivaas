/** Shared display helpers. */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹6,466 — Indian digit grouping, no paise (society billing is whole ₹). */
export function formatINR(amount: number): string {
  return inr.format(amount);
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-11" → "Nov 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/** Human age of a complaint: "3h", "2d 4h". */
export function ageLabel(createdAt: Date | string, now = new Date()): string {
  const ms = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

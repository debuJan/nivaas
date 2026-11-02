/**
 * Committee summary: the monthly report the federation can trust.
 * One pure-ish computation over Prisma reads, shared by the API route
 * and the committee page so the numbers can never drift apart.
 */
import { prisma } from "./db";

export interface AgeingBucket {
  label: string;
  flats: number;
  dueAmount: number;
}

export interface CommitteeSummary {
  month: string;
  totalBilled: number;
  totalCollected: number;
  collectionPct: number;
  totalDue: number;
  ageing: AgeingBucket[];
  complaintsByStatus: Record<string, number>;
  complaintsByCategory: Record<string, number>;
  openComplaints: number;
  avgResolutionHours: number | null;
}

const BUCKETS: Array<{ label: string; maxDays: number }> = [
  { label: "0–30 days", maxDays: 30 },
  { label: "31–60 days", maxDays: 60 },
  { label: "61–90 days", maxDays: 90 },
  { label: "90+ days", maxDays: Number.POSITIVE_INFINITY },
];

const dueOf = (b: { baseAmount: number; lateFee: number; paidAmount: number }) =>
  b.baseAmount + b.lateFee - b.paidAmount;

export async function committeeSummary(month = "2026-11"): Promise<CommitteeSummary> {
  const now = new Date();

  const monthBills = await prisma.bill.findMany({ where: { month } });
  const totalBilled = monthBills.reduce((s, b) => s + b.baseAmount + b.lateFee, 0);
  const totalCollected = monthBills.reduce((s, b) => s + b.paidAmount, 0);

  // Ageing: per flat, the age of its OLDEST unpaid bill decides the bucket —
  // a flat 90 days behind on October is a 90+ risk even if November is fresh.
  const openBills = await prisma.bill.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
  });
  const perFlat = new Map<string, { oldest: Date; due: number }>();
  for (const b of openBills) {
    const cur = perFlat.get(b.flatId) ?? { oldest: b.dueDate, due: 0 };
    if (b.dueDate < cur.oldest) cur.oldest = b.dueDate;
    cur.due += dueOf(b);
    perFlat.set(b.flatId, cur);
  }
  const ageing: AgeingBucket[] = BUCKETS.map((b) => ({
    label: b.label,
    flats: 0,
    dueAmount: 0,
  }));
  for (const { oldest, due } of perFlat.values()) {
    const days = Math.max(
      0,
      Math.floor((now.getTime() - oldest.getTime()) / 86_400_000),
    );
    const idx = BUCKETS.findIndex((b) => days <= b.maxDays);
    ageing[idx].flats += 1;
    ageing[idx].dueAmount += due;
  }
  const totalDue = ageing.reduce((s, b) => s + b.dueAmount, 0);

  const open = await prisma.complaint.findMany({
    where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
  });
  const complaintsByStatus: Record<string, number> = {};
  const complaintsByCategory: Record<string, number> = {};
  for (const c of open) {
    complaintsByStatus[c.status] = (complaintsByStatus[c.status] ?? 0) + 1;
    complaintsByCategory[c.category] = (complaintsByCategory[c.category] ?? 0) + 1;
  }

  const resolved = await prisma.complaint.findMany({
    where: { resolvedAt: { not: null } },
    select: { createdAt: true, resolvedAt: true },
  });
  const avgResolutionHours =
    resolved.length === 0
      ? null
      : Math.round(
          (resolved.reduce(
            (s, c) => s + (c.resolvedAt!.getTime() - c.createdAt.getTime()),
            0,
          ) /
            resolved.length /
            3_600_000) *
            10,
        ) / 10;

  return {
    month,
    totalBilled,
    totalCollected,
    collectionPct:
      totalBilled === 0 ? 100 : Math.round((totalCollected / totalBilled) * 1000) / 10,
    totalDue,
    ageing,
    complaintsByStatus,
    complaintsByCategory,
    openComplaints: open.length,
    avgResolutionHours,
  };
}

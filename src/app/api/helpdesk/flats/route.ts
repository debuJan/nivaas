import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";

/** Flats with an open bill — the targets a queued payment can post to. */
export async function GET() {
  const session = await requireRole("HELPDESK");
  if (!session) {
    return NextResponse.json({ error: "Help desk only." }, { status: 403 });
  }
  const bills = await prisma.bill.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
    include: { flat: { select: { id: true, code: true } } },
    orderBy: [{ dueDate: "asc" }],
  });
  const byFlat = new Map<string, { id: string; code: string; openDue: number }>();
  for (const b of bills) {
    const cur = byFlat.get(b.flat.id) ?? { id: b.flat.id, code: b.flat.code, openDue: 0 };
    cur.openDue += b.baseAmount + b.lateFee - b.paidAmount;
    byFlat.set(b.flat.id, cur);
  }
  return NextResponse.json({ flats: [...byFlat.values()] });
}

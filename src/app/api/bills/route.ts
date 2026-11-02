import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";

const dueOf = (b: { baseAmount: number; lateFee: number; paidAmount: number }) =>
  b.baseAmount + b.lateFee - b.paidAmount;

/** Bills + ledger for every flat the signed-in resident belongs to. */
export async function GET() {
  const session = await requireRole("RESIDENT");
  if (!session) {
    return NextResponse.json({ error: "Residents only." }, { status: 403 });
  }
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: {
      flat: {
        include: {
          bills: { orderBy: [{ month: "desc" }] },
          payments: {
            where: { status: "POSTED" },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  const flats = memberships.map((m) => {
    const bills = m.flat.bills.map((b) => ({ ...b, dueAmount: dueOf(b) }));
    return {
      flat: { id: m.flat.id, code: m.flat.code, tower: m.flat.tower },
      membershipType: m.type,
      bills,
      ledger: m.flat.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        source: p.source,
        reference: p.reference,
        createdAt: p.createdAt,
        billMonth: bills.find((b) => b.id === p.billId)?.month ?? null,
      })),
      totalDue: bills.reduce((s, b) => s + Math.max(0, b.dueAmount), 0),
    };
  });
  return NextResponse.json({
    flats,
    grandTotalDue: flats.reduce((s, f) => s + f.totalDue, 0),
  });
}

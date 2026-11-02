import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";

/**
 * A human places a queued payment — onto the chosen flat's oldest open
 * bill — or rejects it. This is the only path by which an unclear
 * payment can reach a flat, and it stays on the record as a decision.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole("HELPDESK");
  if (!session) {
    return NextResponse.json({ error: "Help desk only." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.status !== "QUEUED") {
    return NextResponse.json(
      { error: "Queue entry not found (or already resolved)." },
      { status: 404 },
    );
  }

  if (action === "REJECT") {
    const updated = await prisma.payment.update({
      where: { id },
      data: { status: "REJECTED" },
    });
    return NextResponse.json({ payment: updated });
  }

  if (action === "POST_TO_FLAT") {
    const flatId = String(body?.flatId ?? "");
    if (!flatId) {
      return NextResponse.json(
        { error: "Choose the flat to post this payment to." },
        { status: 400 },
      );
    }
    const oldest = await prisma.bill.findFirst({
      where: { flatId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      orderBy: [{ dueDate: "asc" }],
    });
    if (!oldest) {
      return NextResponse.json(
        { error: "That flat has no open bill to post against." },
        { status: 400 },
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id },
        data: { status: "POSTED", flatId, billId: oldest.id },
      });
      const newPaid = oldest.paidAmount + payment.amount;
      const total = oldest.baseAmount + oldest.lateFee;
      await tx.bill.update({
        where: { id: oldest.id },
        data: {
          paidAmount: newPaid,
          status: newPaid >= total ? "PAID" : "PARTIALLY_PAID",
        },
      });
      return p;
    });
    return NextResponse.json({ payment: updated });
  }

  return NextResponse.json(
    { error: "action must be POST_TO_FLAT or REJECT." },
    { status: 400 },
  );
}

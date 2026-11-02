import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";

/**
 * Mock payment gateway: the resident pays the full remaining due for one
 * bill. No real money moves — the gateway returns instantly, like a
 * payment provider in test mode, and the receipt carries a MOCKPAY ref.
 * Payment + bill update happen in one transaction so the ledger and the
 * bill can never disagree.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole("RESIDENT");
  if (!session) {
    return NextResponse.json({ error: "Residents only." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const method = String(body?.method ?? "");
  if (method !== "UPI" && method !== "CARD") {
    return NextResponse.json(
      { error: "Choose a payment method (UPI or Card)." },
      { status: 400 },
    );
  }

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { flat: true },
  });
  if (!bill) {
    return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  }
  const owns = await prisma.membership.findUnique({
    where: { userId_flatId: { userId: session.userId, flatId: bill.flatId } },
  });
  if (!owns) {
    return NextResponse.json(
      { error: "This bill belongs to another flat." },
      { status: 403 },
    );
  }
  if (bill.status === "PAID") {
    return NextResponse.json(
      { error: "This bill is already paid." },
      { status: 409 },
    );
  }

  const amount = bill.baseAmount + bill.lateFee - bill.paidAmount;
  const reference = `MOCKPAY-${randomBytes(4).toString("hex").toUpperCase()}`;
  const receipt = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        flatId: bill.flatId,
        billId: bill.id,
        source: "ONLINE",
        amount,
        reference,
        status: "POSTED",
      },
    });
    await tx.bill.update({
      where: { id: bill.id },
      data: { paidAmount: bill.paidAmount + amount, status: "PAID" },
    });
    return {
      paymentId: payment.id,
      amount,
      reference,
      method,
      flatCode: bill.flat.code,
      month: bill.month,
      date: payment.createdAt,
    };
  });
  return NextResponse.json({ receipt });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { parseBankCsv } from "@/lib/csv";
import { matchPayments, type Verdict } from "@/lib/matching";

/**
 * Run a bank statement through the matching engine and apply the result.
 * POSTED verdicts credit bills; QUEUED rows become queue payments with
 * the raw statement row preserved. The engine's `remaining` bookkeeping
 * and the DB updates run in the same order, so a bill credited by an
 * early row is never credited twice by a later row in the same file.
 */
export async function POST(req: Request) {
  const session = await requireRole("HELPDESK");
  if (!session) {
    return NextResponse.json({ error: "Help desk only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const csvText = String(body?.csv ?? "");
  if (!csvText.trim()) {
    return NextResponse.json(
      { error: "Paste or upload a bank statement CSV first." },
      { status: 400 },
    );
  }

  const { rows, errors } = parseBankCsv(csvText);
  if (rows.length === 0 && errors.length === 0) {
    return NextResponse.json(
      { error: "No statement rows found. The CSV needs a header row (date, narration, amount…)." },
      { status: 400 },
    );
  }

  const openBills = await prisma.bill.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
    include: { flat: { select: { id: true, code: true, upiId: true } } },
    orderBy: [{ dueDate: "asc" }],
  });
  const upiToFlat: Record<string, string> = {};
  for (const b of openBills) {
    if (b.flat.upiId) upiToFlat[b.flat.upiId.toLowerCase()] = b.flat.code;
  }
  const engineBills = openBills.map((b) => ({
    billId: b.id,
    flatCode: b.flat.code,
    dueAmount: b.baseAmount + b.lateFee - b.paidAmount,
  }));

  const verdicts = matchPayments({ rows, bills: engineBills, upiToFlat });

  // Apply: one transaction, in statement order. Verdicts come back in row
  // order, so rows[i].raw is the audit copy of verdicts[i]'s statement row.
  const billPaidSoFar = new Map<string, number>();
  await prisma.$transaction(async (tx) => {
    for (const [i, v] of verdicts.entries()) {
      const reference = v.row.reference ?? "NO-REF";
      const rawRow = rows[i]?.raw ?? {};
      if (v.verdict === "POSTED" && v.billId) {
        const bill = openBills.find((b) => b.id === v.billId)!;
        await tx.payment.create({
          data: {
            flatId: bill.flat.id,
            billId: bill.id,
            source: "BANK_MATCH",
            amount: v.row.amount,
            reference,
            payerUpiId: v.row.upiId ?? null,
            status: "POSTED",
            rawRow,
          },
        });
        const already = billPaidSoFar.get(bill.id) ?? 0;
        const newPaid = bill.paidAmount + already + v.row.amount;
        billPaidSoFar.set(bill.id, already + v.row.amount);
        const total = bill.baseAmount + bill.lateFee;
        await tx.bill.update({
          where: { id: bill.id },
          data: {
            paidAmount: newPaid,
            status: newPaid >= total ? "PAID" : "PARTIALLY_PAID",
          },
        });
      } else {
        await tx.payment.create({
          data: {
            flatId: null,
            billId: null,
            source: "BANK_MATCH",
            amount: v.row.amount,
            reference,
            payerUpiId: v.row.upiId ?? null,
            status: "QUEUED",
            rawRow,
          },
        });
      }
    }
    // Unparseable rows queue too — visible, explained, never dropped.
    for (const e of errors) {
      await tx.payment.create({
        data: {
          flatId: null,
          billId: null,
          source: "BANK_MATCH",
          amount: 0,
          reference: "UNPARSED",
          status: "QUEUED",
          rawRow: e.raw,
        },
      });
    }
  });

  const allVerdicts: Array<Verdict | { row: unknown; verdict: "QUEUED"; tier: number; reason: string }> = [
    ...verdicts,
    ...errors.map((e) => ({
      row: e.raw,
      verdict: "QUEUED" as const,
      tier: 6,
      reason: e.reason,
    })),
  ];
  return NextResponse.json({
    verdicts: allVerdicts,
    posted: verdicts.filter((v) => v.verdict === "POSTED").length,
    queued: allVerdicts.filter((v) => v.verdict === "QUEUED").length,
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";

/** The accounts queue: payments a human must place or reject. */
export async function GET() {
  const session = await requireRole("HELPDESK");
  if (!session) {
    return NextResponse.json({ error: "Help desk only." }, { status: 403 });
  }
  const queue = await prisma.payment.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ queue });
}

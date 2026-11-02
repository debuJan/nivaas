import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";

/** Every complaint in the township, newest first — the help desk board. */
export async function GET() {
  const session = await requireRole("HELPDESK");
  if (!session) {
    return NextResponse.json({ error: "Help desk only." }, { status: 403 });
  }
  const complaints = await prisma.complaint.findMany({
    include: {
      flat: { select: { code: true, tower: true } },
      raisedBy: { select: { name: true } },
      duplicateOf: { select: { id: true, title: true } },
      _count: { select: { duplicates: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ complaints });
}

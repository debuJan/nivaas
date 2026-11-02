import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import type { ComplaintCategory, ComplaintStatus } from "@prisma/client";

const CATEGORIES: ComplaintCategory[] = [
  "PLUMBING", "ELECTRICAL", "LIFT", "CARPENTRY", "HOUSEKEEPING", "SECURITY", "OTHER",
];
const STATUSES: ComplaintStatus[] = [
  "OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED",
];

/**
 * One-tap corrections from the board: a single PATCH moves the status,
 * fixes a mis-filed category, or reassigns the team. Setting RESOLVED /
 * CLOSED stamps resolvedAt (the committee's average-resolution number
 * reads it); reopening clears it.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole("HELPDESK");
  if (!session) {
    return NextResponse.json({ error: "Help desk only." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const data: {
    status?: ComplaintStatus;
    category?: ComplaintCategory;
    assignedTeam?: string;
    resolvedAt?: Date | null;
  } = {};
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    data.status = body.status;
    if (body.status === "RESOLVED" || body.status === "CLOSED") {
      data.resolvedAt = new Date();
    } else {
      data.resolvedAt = null;
    }
  }
  if (body?.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: "Unknown category." }, { status: 400 });
    }
    data.category = body.category;
  }
  if (typeof body?.assignedTeam === "string" && body.assignedTeam.trim()) {
    data.assignedTeam = body.assignedTeam.trim();
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const complaint = await prisma.complaint.update({
    where: { id },
    data,
    include: { flat: { select: { code: true, tower: true } } },
  }).catch(() => null);
  if (!complaint) {
    return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
  }
  return NextResponse.json({ complaint });
}

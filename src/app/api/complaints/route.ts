import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { classifyComplaint, findDuplicates } from "@/lib/classify";
import { TEAM_BY_CATEGORY } from "@/lib/teams";

export async function GET() {
  const session = await requireRole("RESIDENT");
  if (!session) {
    return NextResponse.json({ error: "Residents only." }, { status: 403 });
  }
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { flatId: true },
  });
  const complaints = await prisma.complaint.findMany({
    where: { flatId: { in: memberships.map((m) => m.flatId) } },
    include: {
      flat: { select: { code: true, tower: true } },
      duplicateOf: { select: { id: true, title: true } },
      _count: { select: { duplicates: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ complaints });
}

interface ComplaintInput {
  flatId: string;
  title: string;
  description: string;
  photoUrl: string | null;
}

/** Accept either JSON (photoUrl string) or a multipart form with a file. */
async function readInput(req: Request): Promise<ComplaintInput | { error: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    let photoUrl: string | null = null;
    const file = form.get("photo");
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/") || file.size > 5_000_000) {
        return { error: "Photo must be an image under 5 MB." };
      }
      const ext = path.extname(file.name) || ".jpg";
      const name = `complaint-${Date.now()}${ext}`;
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      photoUrl = `/uploads/${name}`;
    }
    return {
      flatId: String(form.get("flatId") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      photoUrl,
    };
  }
  const body = await req.json().catch(() => null);
  return {
    flatId: String(body?.flatId ?? ""),
    title: String(body?.title ?? ""),
    description: String(body?.description ?? ""),
    photoUrl: body?.photoUrl ? String(body.photoUrl) : null,
  };
}

export async function POST(req: Request) {
  const session = await requireRole("RESIDENT");
  if (!session) {
    return NextResponse.json({ error: "Residents only." }, { status: 403 });
  }
  const input = await readInput(req);
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  if (!input.flatId || input.title.trim().length < 3 || input.description.trim().length < 5) {
    return NextResponse.json(
      { error: "Give the complaint a short title and a few words of detail." },
      { status: 400 },
    );
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_flatId: { userId: session.userId, flatId: input.flatId } },
    include: { flat: true },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "You can only raise complaints for your own flat." },
      { status: 403 },
    );
  }
  const flat = membership.flat;

  // The AI verdict: classify first (safety rules outrank everything),
  // then look for the same problem already reported in this tower.
  const verdict = classifyComplaint(`${input.title} ${input.description}`);
  const openInTower = await prisma.complaint.findMany({
    where: {
      flat: { tower: flat.tower },
      status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] },
    },
    include: { flat: { select: { tower: true } } },
  });
  const duplicateIds = findDuplicates(
    `${input.title} ${input.description}`,
    flat.tower,
    new Date(),
    openInTower.map((c) => ({
      id: c.id,
      text: `${c.title} ${c.description}`,
      tower: c.flat.tower,
      createdAt: c.createdAt,
    })),
  );

  const team = TEAM_BY_CATEGORY[verdict.category];
  const complaint = await prisma.complaint.create({
    data: {
      flatId: flat.id,
      raisedById: session.userId,
      title: input.title.trim(),
      description: input.description.trim(),
      photoUrl: input.photoUrl,
      category: verdict.category,
      urgency: verdict.urgency,
      aiConfidence: verdict.confidence,
      duplicateOfId: duplicateIds[0] ?? null,
      assignedTeam:
        team + (verdict.escalated ? " + Duty Manager" : ""),
      status: "ASSIGNED",
    },
    include: { flat: { select: { code: true, tower: true } } },
  });

  return NextResponse.json(
    {
      complaint,
      ai: {
        category: verdict.category,
        urgency: verdict.urgency,
        confidence: verdict.confidence,
        escalated: verdict.escalated,
        duplicateOfId: duplicateIds[0] ?? null,
      },
    },
    { status: 201 },
  );
}

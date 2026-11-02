import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { committeeSummary } from "@/lib/committee";

export async function GET() {
  const session = await requireRole("COMMITTEE");
  if (!session) {
    return NextResponse.json({ error: "Committee only." }, { status: 403 });
  }
  return NextResponse.json(await committeeSummary());
}

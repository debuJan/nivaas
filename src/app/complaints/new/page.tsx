import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { ResidentShell } from "@/components/ResidentShell";
import { ComplaintForm } from "./ComplaintForm";

export default async function NewComplaintPage() {
  const session = await requirePageSession("RESIDENT");
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { flat: { select: { id: true, code: true } } },
  });
  return (
    <ResidentShell
      session={session}
      flatLabel={memberships.map((m) => m.flat.code).join(" · ")}
    >
      <h2 className="mb-4 text-lg font-semibold">Raise a complaint</h2>
      <div className="mx-auto max-w-xl">
        <ComplaintForm flats={memberships.map((m) => m.flat)} />
      </div>
    </ResidentShell>
  );
}

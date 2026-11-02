import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { ResidentShell } from "@/components/ResidentShell";
import { ComplaintStatusChip, UrgencyChip } from "@/components/chips";

export default async function ComplaintsPage() {
  const session = await requirePageSession("RESIDENT");
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { flatId: true, flat: { select: { code: true } } },
  });
  const complaints = await prisma.complaint.findMany({
    where: { flatId: { in: memberships.map((m) => m.flatId) } },
    include: {
      flat: { select: { code: true } },
      duplicateOf: { select: { title: true } },
      _count: { select: { duplicates: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ResidentShell
      session={session}
      flatLabel={memberships.map((m) => m.flat.code).join(" · ")}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">My complaints</h2>
        <Link
          href="/complaints/new"
          className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark"
        >
          + New complaint
        </Link>
      </div>

      {complaints.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-stone-500 ring-1 ring-stone-200">
          You have not raised any complaints yet. When something breaks, raise
          one here — you will always see where it stands.
        </p>
      ) : (
        <ul className="space-y-3">
          {complaints.map((c) => (
            <li
              key={c.id}
              className={`rounded-2xl bg-white p-4 ring-1 ${
                c.urgency === "CRITICAL" ? "ring-rose-300" : "ring-stone-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="mt-0.5 text-sm text-stone-600">{c.description}</p>
                  <p className="mt-1.5 text-xs text-stone-400">
                    {c.flat.code} · {c.category} · Raised {formatDate(c.createdAt)}
                    {c.assignedTeam && ` · Team: ${c.assignedTeam}`}
                  </p>
                  {c.duplicateOf && (
                    <p className="mt-1 text-xs font-medium text-indigo-600">
                      Linked as a duplicate of “{c.duplicateOf.title}” — same
                      issue, tracked together.
                    </p>
                  )}
                  {c._count.duplicates > 0 && (
                    <p className="mt-1 text-xs font-medium text-indigo-600">
                      {c._count.duplicates} more flat(s) reported the same
                      issue — linked to this one.
                    </p>
                  )}
                  {c.rating && (
                    <p className="mt-1 text-xs text-amber-500">
                      {"★".repeat(c.rating)}
                      <span className="text-stone-400"> — your rating</span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ComplaintStatusChip status={c.status} />
                  <UrgencyChip urgency={c.urgency} />
                </div>
              </div>
              {c.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.photoUrl}
                  alt="Complaint attachment"
                  className="mt-3 max-h-48 rounded-xl object-cover"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </ResidentShell>
  );
}

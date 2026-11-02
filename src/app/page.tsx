import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { formatINR, formatMonth } from "@/lib/format";
import { ResidentShell } from "@/components/ResidentShell";
import { ComplaintStatusChip, UrgencyLabel } from "@/components/chips";

export default async function HomePage() {
  const session = await requirePageSession("RESIDENT");
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { flat: true },
  });
  const flatIds = memberships.map((m) => m.flatId);

  const openBills = await prisma.bill.findMany({
    where: { flatId: { in: flatIds }, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
    orderBy: [{ dueDate: "asc" }],
    include: { flat: { select: { code: true } } },
  });
  const totalDue = openBills.reduce(
    (s, b) => s + b.baseAmount + b.lateFee - b.paidAmount,
    0,
  );
  const complaints = await prisma.complaint.findMany({
    where: {
      flatId: { in: flatIds },
      status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] },
    },
    include: { flat: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const notices = await prisma.notice.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const flatLabel = memberships.map((m) => m.flat.code).join(" · ");

  return (
    <ResidentShell session={session} flatLabel={flatLabel}>
      <div className="space-y-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <p className="text-sm text-stone-500">
            Welcome back, {session.name.split(" ")[0]}
          </p>
          {totalDue > 0 ? (
            <>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {formatINR(totalDue)}{" "}
                <span className="text-base font-normal text-stone-500">due</span>
              </p>
              <ul className="mt-3 space-y-1 text-sm text-stone-600">
                {openBills.map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span>
                      {b.flat.code} — {formatMonth(b.month)}
                      {b.lateFee > 0 && (
                        <span className="text-stone-400">
                          {" "}(incl. late fee {formatINR(b.lateFee)})
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {formatINR(b.baseAmount + b.lateFee - b.paidAmount)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/bills"
                className="mt-4 inline-block rounded-xl bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-dark"
              >
                Pay now
              </Link>
            </>
          ) : (
            <p className="mt-2 text-lg font-medium text-teal-700">
              All clear — no maintenance due. 🎉
            </p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Open complaints</h2>
            <Link href="/complaints/new" className="text-sm font-medium text-accent">
              + Raise one
            </Link>
          </div>
          {complaints.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">
              No open complaints. If something needs fixing, raise one — it
              reaches the right team straight away.
            </p>
          ) : (
            <ul className="space-y-2">
              {complaints.map((c) => (
                <li key={c.id}>
                  <Link
                    href="/complaints"
                    className="block rounded-2xl bg-white p-4 ring-1 ring-stone-200 transition hover:ring-teal-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {c.flat.code} · {c.category.replace("_", " ")} ·{" "}
                          {c.assignedTeam ?? "Awaiting assignment"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <ComplaintStatusChip status={c.status} />
                        <UrgencyLabel urgency={c.urgency} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Notices</h2>
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                <p className="font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-stone-600">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ResidentShell>
  );
}

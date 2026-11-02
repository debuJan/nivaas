import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { formatINR, formatDate, formatMonth } from "@/lib/format";
import { ResidentShell } from "@/components/ResidentShell";
import { BillStatusChip } from "@/components/chips";
import { PayButton } from "./PayButton";

export default async function BillsPage() {
  const session = await requirePageSession("RESIDENT");
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: {
      flat: {
        include: {
          bills: { orderBy: [{ month: "desc" }] },
          payments: {
            where: { status: "POSTED" },
            orderBy: { createdAt: "desc" },
            include: { bill: { select: { month: true } } },
          },
        },
      },
    },
  });

  return (
    <ResidentShell
      session={session}
      flatLabel={memberships.map((m) => m.flat.code).join(" · ")}
    >
      {memberships.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-stone-500 ring-1 ring-stone-200">
          No flat is linked to your account yet. Please ask the help desk to
          add your flat — your bills will appear here as soon as it is linked.
        </p>
      ) : (
      <div className="space-y-8">
        {memberships.map((m) => {
          const totalDue = m.flat.bills.reduce(
            (s, b) => s + Math.max(0, b.baseAmount + b.lateFee - b.paidAmount),
            0,
          );
          return (
            <section key={m.flat.id}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{m.flat.code}</h2>
                <p className="text-sm text-stone-500">
                  {totalDue > 0 ? (
                    <>
                      Total due{" "}
                      <span className="font-semibold text-rose-600">
                        {formatINR(totalDue)}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium text-teal-700">Nothing due</span>
                  )}
                </p>
              </div>

              <div className="space-y-3">
                {m.flat.bills.map((b) => {
                  const due = b.baseAmount + b.lateFee - b.paidAmount;
                  return (
                    <article
                      key={b.id}
                      className="rounded-2xl bg-white p-4 ring-1 ring-stone-200"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{formatMonth(b.month)}</p>
                          <p className="mt-0.5 text-sm text-stone-500">
                            Base {formatINR(b.baseAmount)}
                            {b.lateFee > 0 &&
                              ` · Late fee ${formatINR(b.lateFee)}`}
                            {b.paidAmount > 0 &&
                              ` · Paid ${formatINR(b.paidAmount)}`}
                          </p>
                          <p className="text-xs text-stone-400">
                            Due date {formatDate(b.dueDate)}
                          </p>
                        </div>
                        <BillStatusChip status={b.status} />
                      </div>
                      {due > 0 && (
                        <div className="mt-3 flex justify-end border-t border-stone-100 pt-3">
                          <PayButton billId={b.id} dueAmount={due} month={b.month} />
                        </div>
                      )}
                    </article>
                  );
                })}
                {m.flat.bills.length === 0 && (
                  <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">
                    No bills yet for this flat.
                  </p>
                )}
              </div>

              <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-stone-400">
                Payment history — {m.flat.code}
              </h3>
              {m.flat.payments.length === 0 ? (
                <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 ring-1 ring-stone-200">
                  No payments recorded yet.
                </p>
              ) : (
                <ul className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
                  {m.flat.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{formatINR(p.amount)}</p>
                        <p className="text-xs text-stone-400">
                          {p.bill ? formatMonth(p.bill.month) : "Advance"} ·{" "}
                          {p.source === "ONLINE"
                            ? "Paid in app"
                            : p.source === "BANK_MATCH"
                              ? "Bank transfer (matched)"
                              : "Recorded by help desk"}{" "}
                          · {formatDate(p.createdAt)}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-stone-400">
                        {p.reference}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      )}
    </ResidentShell>
  );
}

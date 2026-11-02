import { requirePageSession } from "@/lib/session";
import { committeeSummary } from "@/lib/committee";
import { formatINR, formatMonth } from "@/lib/format";
import { AppHeader } from "@/components/AppHeader";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-stone-500">{sub}</p>}
    </div>
  );
}

export default async function CommitteePage() {
  const session = await requirePageSession("COMMITTEE");
  const s = await committeeSummary();
  const maxCategory = Math.max(1, ...Object.values(s.complaintsByCategory));

  return (
    <div className="min-h-screen">
      <AppHeader name={session.name} subtitle="Federation committee" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-5">
        <div>
          <h2 className="text-lg font-semibold">
            {formatMonth(s.month)} — township report
          </h2>
          <p className="text-sm text-stone-500">
            Collections, dues ageing and complaint health, straight from the
            ledger — no hand-built Excel.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Collection"
            value={`${s.collectionPct}%`}
            sub={`${formatINR(s.totalCollected)} of ${formatINR(s.totalBilled)} billed`}
          />
          <StatCard
            label="Total outstanding"
            value={formatINR(s.totalDue)}
            sub="across all open bills"
          />
          <StatCard
            label="Open complaints"
            value={String(s.openComplaints)}
            sub={
              s.complaintsByStatus.IN_PROGRESS
                ? `${s.complaintsByStatus.IN_PROGRESS} in progress`
                : undefined
            }
          />
          <StatCard
            label="Avg. resolution"
            value={
              s.avgResolutionHours != null ? `${s.avgResolutionHours} hrs` : "—"
            }
            sub="on resolved complaints"
          />
        </div>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <h3 className="font-semibold">Dues ageing</h3>
          <p className="mt-0.5 text-sm text-stone-500">
            By the age of each flat&apos;s oldest unpaid bill.
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
                <th className="py-2 font-medium">Age of dues</th>
                <th className="py-2 font-medium">Flats</th>
                <th className="py-2 text-right font-medium">Amount due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {s.ageing.map((b) => (
                <tr key={b.label}>
                  <td className="py-2.5 font-medium">{b.label}</td>
                  <td className="py-2.5">{b.flats}</td>
                  <td className="py-2.5 text-right">{formatINR(b.dueAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <h3 className="font-semibold">Open complaints by category</h3>
          {Object.keys(s.complaintsByCategory).length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">
              No open complaints — the township is quiet. 🎉
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {Object.entries(s.complaintsByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <li key={cat} className="flex items-center gap-3 text-sm">
                    <span className="w-32 font-medium">{cat}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${(count / maxCategory) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 text-right text-stone-500">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

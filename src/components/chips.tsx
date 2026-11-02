const BILL_STYLES: Record<string, string> = {
  PAID: "bg-teal-50 text-teal-700 ring-teal-200",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700 ring-amber-200",
  UNPAID: "bg-rose-50 text-rose-700 ring-rose-200",
};

const COMPLAINT_STYLES: Record<string, string> = {
  OPEN: "bg-sky-50 text-sky-700 ring-sky-200",
  ASSIGNED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-200",
  RESOLVED: "bg-teal-50 text-teal-700 ring-teal-200",
  CLOSED: "bg-stone-100 text-stone-500 ring-stone-200",
};

export function BillStatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${BILL_STYLES[status] ?? BILL_STYLES.UNPAID}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function ComplaintStatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${COMPLAINT_STYLES[status] ?? COMPLAINT_STYLES.OPEN}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

const URGENCY_STYLES: Record<string, string> = {
  LOW: "text-stone-500",
  MEDIUM: "text-amber-600",
  HIGH: "text-orange-600",
  CRITICAL: "text-rose-600",
};

export function UrgencyLabel({ urgency }: { urgency: string }) {
  return (
    <span className={`text-xs font-semibold ${URGENCY_STYLES[urgency] ?? ""}`}>
      {urgency === "CRITICAL" ? "⚠ CRITICAL" : urgency}
    </span>
  );
}

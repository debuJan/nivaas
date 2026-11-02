// One status-chip system for the whole app. Every status, urgency and
// payment verdict renders through these components so colours mean the
// same thing on every screen:
//   green  = done / paid / posted      amber = in progress / needs a human
//   rose   = unpaid                     blue/indigo = open / assigned
//   gray   = closed / rejected          solid red = CRITICAL (safety)

const CHIP =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

const BILL_STYLES: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 ring-1 ring-green-200",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  UNPAID: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

const COMPLAINT_STYLES: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  ASSIGNED: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  RESOLVED: "bg-green-50 text-green-700 ring-1 ring-green-200",
  CLOSED: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
};

const URGENCY_STYLES: Record<string, string> = {
  LOW: "bg-stone-100 text-stone-500 ring-1 ring-stone-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  HIGH: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  // Solid red: a CRITICAL complaint is a safety escalation, it must read
  // as an alarm from across the room, not as another tinted label.
  CRITICAL: "bg-red-600 font-semibold text-white",
};

const PAYMENT_STYLES: Record<string, string> = {
  POSTED: "bg-green-50 text-green-700 ring-1 ring-green-200",
  QUEUED: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  REJECTED: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
};

export function BillStatusChip({ status }: { status: string }) {
  return (
    <span className={`${CHIP} ${BILL_STYLES[status] ?? BILL_STYLES.UNPAID}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function ComplaintStatusChip({ status }: { status: string }) {
  return (
    <span
      className={`${CHIP} ${COMPLAINT_STYLES[status] ?? COMPLAINT_STYLES.OPEN}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function UrgencyChip({ urgency }: { urgency: string }) {
  return (
    <span
      className={`${CHIP} ${URGENCY_STYLES[urgency] ?? URGENCY_STYLES.LOW}`}
    >
      {urgency === "CRITICAL" ? "⚠ CRITICAL" : urgency}
    </span>
  );
}

export function PaymentStatusChip({ status }: { status: string }) {
  return (
    <span
      className={`${CHIP} ${PAYMENT_STYLES[status] ?? PAYMENT_STYLES.QUEUED}`}
    >
      {status}
    </span>
  );
}

/**
 * Nivaas seed data — a believable slice of the township.
 *
 * Facts anchored to the client brief:
 *  - Maintenance rate ₹6.50 / sq ft / month.
 *  - T07-1203 Neeraj Kulkarni, 1150 sqft → ₹7,475 bill, PAID.
 *  - T12-0408 Swati Joshi (tenant), 980 sqft → ₹6,370 bill, unpaid,
 *    47 days overdue at the reference date, 1 water-leak complaint.
 *  - T21-1601 Aamir Shaikh, 1640 sqft → ₹10,660 bill, ₹5,000 paid (partial).
 *
 * Late fee rule (assumption, stated in the TDD): 1.5% of the base amount
 * per full month overdue, rounded to whole rupees.
 *
 * "Today" for ageing in this seed is 2026-11-26 (REFERENCE_DATE) so the
 * overdue figures are stable whenever the seed is re-run.
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const RATE_PER_SQFT = 6.5;
const REFERENCE_DATE = new Date("2026-11-26T00:00:00Z");

function lateFeeFor(baseAmount: number, dueDate: Date): number {
  const days = Math.floor(
    (REFERENCE_DATE.getTime() - dueDate.getTime()) / 86_400_000,
  );
  if (days <= 0) return 0;
  const fullMonths = Math.floor(days / 30);
  return Math.round(baseAmount * 0.015 * fullMonths);
}

interface FlatSpec {
  code: string;
  areaSqft: number;
  ownerName: string;
  /** Resident who actually lives here (owner, or a tenant where noted). */
  residentName: string;
  residentType: "OWNER" | "TENANT";
}

const FLATS: FlatSpec[] = [
  // Tower T07
  { code: "T07-1203", areaSqft: 1150, ownerName: "Neeraj Kulkarni", residentName: "Neeraj Kulkarni", residentType: "OWNER" },
  { code: "T07-0502", areaSqft: 980, ownerName: "Anita Deshmukh", residentName: "Anita Deshmukh", residentType: "OWNER" },
  { code: "T07-0901", areaSqft: 1250, ownerName: "Rajesh Iyer", residentName: "Rajesh Iyer", residentType: "OWNER" },
  { code: "T07-1404", areaSqft: 1100, ownerName: "Meera Patil", residentName: "Meera Patil", residentType: "OWNER" },
  // Tower T12
  { code: "T12-0408", areaSqft: 980, ownerName: "Ramesh Bhandari", residentName: "Swati Joshi", residentType: "TENANT" },
  { code: "T12-0901", areaSqft: 1150, ownerName: "Kavita Reddy", residentName: "Kavita Reddy", residentType: "OWNER" },
  { code: "T12-1102", areaSqft: 1250, ownerName: "Arjun Malhotra", residentName: "Arjun Malhotra", residentType: "OWNER" },
  { code: "T12-0603", areaSqft: 980, ownerName: "Sana Sheikh", residentName: "Sana Sheikh", residentType: "OWNER" },
  { code: "T12-1404", areaSqft: 1640, ownerName: "Vikram Rao", residentName: "Vikram Rao", residentType: "OWNER" },
  { code: "T12-0201", areaSqft: 1100, ownerName: "Deepa Nair", residentName: "Deepa Nair", residentType: "OWNER" },
  // Tower T21
  { code: "T21-1601", areaSqft: 1640, ownerName: "Aamir Shaikh", residentName: "Aamir Shaikh", residentType: "OWNER" },
  { code: "T21-0302", areaSqft: 980, ownerName: "Farah Khan", residentName: "Farah Khan", residentType: "OWNER" },
  { code: "T21-0805", areaSqft: 1150, ownerName: "Rohit Sharma", residentName: "Rohit Sharma", residentType: "OWNER" },
  { code: "T21-1203", areaSqft: 1250, ownerName: "Sunita Verma", residentName: "Sunita Verma", residentType: "OWNER" },
  { code: "T21-0101", areaSqft: 900, ownerName: "Prakash Jadhav", residentName: "Prakash Jadhav", residentType: "OWNER" },
  // Tower T03
  { code: "T03-0702", areaSqft: 1050, ownerName: "Nilesh Pawar", residentName: "Nilesh Pawar", residentType: "OWNER" },
  { code: "T03-1004", areaSqft: 1200, ownerName: "Ritu Singh", residentName: "Ritu Singh", residentType: "OWNER" },
  { code: "T03-0303", areaSqft: 950, ownerName: "Imran Ansari", residentName: "Imran Ansari", residentType: "OWNER" },
  // Tower T18
  { code: "T18-1502", areaSqft: 1300, ownerName: "Geeta Kulkarni", residentName: "Geeta Kulkarni", residentType: "OWNER" },
  { code: "T18-0601", areaSqft: 1100, ownerName: "Anil Bhatt", residentName: "Anil Bhatt", residentType: "OWNER" },
  { code: "T18-0903", areaSqft: 1000, ownerName: "Pooja Mishra", residentName: "Pooja Mishra", residentType: "OWNER" },
  { code: "T18-0402", areaSqft: 1400, ownerName: "Sanjay Gupta", residentName: "Sanjay Gupta", residentType: "OWNER" },
  { code: "T18-1105", areaSqft: 1150, ownerName: "Rekha Pillai", residentName: "Rekha Pillai", residentType: "OWNER" },
  { code: "T18-0204", areaSqft: 980, ownerName: "Omar Farooq", residentName: "Omar Farooq", residentType: "OWNER" },
];

// Flats whose November bill is still fully unpaid in the seed.
const NOV_UNPAID = new Set(["T12-0408", "T07-1404", "T12-0201", "T03-0303", "T18-0903", "T21-1203"]);
// Flats with an October leftover also unpaid (drives the ageing buckets).
const OCT_UNPAID = new Set(["T12-0408", "T03-0303", "T18-0402"]);

async function main() {
  // Idempotent re-seed: wipe in FK-safe order.
  await prisma.payment.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.flat.deleteMany();
  await prisma.user.deleteMany();
  await prisma.notice.deleteMany();

  // ── Staff users ──────────────────────────────────────────────────────
  await prisma.user.create({
    data: { name: "Priya Nair", phone: "9000000001", role: "HELPDESK" },
  });
  await prisma.user.create({
    data: { name: "R. Menon", phone: "9000000002", role: "COMMITTEE" },
  });

  // ── Flats, residents, memberships ────────────────────────────────────
  const flatByCode = new Map<string, { id: string }>();
  const residentByFlat = new Map<string, { id: string }>();
  let phoneSeq = 9820011100;
  for (const spec of FLATS) {
    const tower = spec.code.split("-")[0];
    const flat = await prisma.flat.create({
      data: { code: spec.code, tower, areaSqft: spec.areaSqft, ownerName: spec.ownerName },
    });
    flatByCode.set(spec.code, flat);

    const resident = await prisma.user.create({
      data: {
        name: spec.residentName,
        phone: String(phoneSeq++),
        role: "RESIDENT",
      },
    });
    residentByFlat.set(spec.code, resident);
    await prisma.membership.create({
      data: { userId: resident.id, flatId: flat.id, type: spec.residentType },
    });
  }
  // One family member, to show the FAMILY membership type.
  const neerajFlat = flatByCode.get("T07-1203")!;
  const family = await prisma.user.create({
    data: { name: "Shreya Kulkarni", phone: String(phoneSeq++), role: "RESIDENT" },
  });
  await prisma.membership.create({
    data: { userId: family.id, flatId: neerajFlat.id, type: "FAMILY" },
  });

  // ── Bills + their payments ───────────────────────────────────────────
  const novDue = new Date("2026-11-10T00:00:00Z");
  const octDue = new Date("2026-10-10T00:00:00Z");
  const billFor = async (
    flatCode: string,
    month: string,
    dueDate: Date,
    state: "PAID" | "UNPAID" | "PARTIAL",
  ) => {
    const spec = FLATS.find((f) => f.code === flatCode)!;
    const flat = flatByCode.get(flatCode)!;
    const base = Math.round(spec.areaSqft * RATE_PER_SQFT);
    const lateFee = state === "PAID" ? 0 : lateFeeFor(base, dueDate);
    const paidAmount = state === "PAID" ? base : state === "PARTIAL" ? 5000 : 0;
    const bill = await prisma.bill.create({
      data: {
        flatId: flat.id,
        month,
        baseAmount: base,
        lateFee,
        dueDate,
        status: state === "PAID" ? "PAID" : state === "PARTIAL" ? "PARTIALLY_PAID" : "UNPAID",
        paidAmount,
      },
    });
    if (paidAmount > 0) {
      await prisma.payment.create({
        data: {
          flatId: flat.id,
          billId: bill.id,
          source: "ONLINE",
          amount: paidAmount,
          reference: `TXN-${flatCode}-${month.replace("-", "")}`,
          payerUpiId: null,
          status: "POSTED",
        },
      });
    }
    return bill;
  };

  for (const spec of FLATS) {
    if (spec.code === "T21-1601") {
      await billFor(spec.code, "2026-11", novDue, "PARTIAL"); // Aamir — brief sample
    } else if (NOV_UNPAID.has(spec.code)) {
      await billFor(spec.code, "2026-11", novDue, "UNPAID");
    } else {
      await billFor(spec.code, "2026-11", novDue, "PAID");
    }
    if (OCT_UNPAID.has(spec.code)) {
      await billFor(spec.code, "2026-10", octDue, "UNPAID");
    } else if (spec.code !== "T21-1601") {
      await billFor(spec.code, "2026-10", octDue, "PAID");
    }
  }

  // ── Two bank-import payments the committee demo will lean on ─────────
  // One clean BANK_MATCH posting, and one unclear row sitting QUEUED with
  // its raw bank row preserved — money is never guessed onto a flat.
  const geetaFlat = flatByCode.get("T18-1502")!;
  await prisma.payment.create({
    data: {
      flatId: geetaFlat.id,
      source: "BANK_MATCH",
      amount: 8450,
      reference: "UTR611023344556",
      payerUpiId: "geeta.k@okaxis",
      status: "POSTED",
      rawRow: { date: "2026-11-03", narration: "UPI/GEETA K/MAINT", amount: 8450 },
    },
  });
  await prisma.payment.create({
    data: {
      flatId: null,
      billId: null,
      source: "BANK_MATCH",
      amount: 6825,
      reference: "UTR611087766554",
      payerUpiId: null,
      status: "QUEUED",
      rawRow: { date: "2026-11-05", narration: "NEFT TRANSFER", amount: 6825 },
    },
  });

  // ── Complaints ───────────────────────────────────────────────────────
  type C = Prisma.ComplaintUncheckedCreateInput;
  const mk = (
    flatCode: string,
    data: Omit<C, "flatId" | "raisedById">,
  ): C => ({
    flatId: flatByCode.get(flatCode)!.id,
    raisedById: residentByFlat.get(flatCode)!.id,
    ...data,
  });

  // The T12 lift cluster: 4 flats, one broken lift, inside 48 hours.
  // Duplicates are linked to the first report — never closed.
  const lift1 = await prisma.complaint.create({
    data: mk("T12-0901", {
      title: "Lift not working",
      description: "Lift not working since morning in our tower. Elderly residents are climbing 9 floors.",
      category: "LIFT",
      urgency: "HIGH",
      status: "IN_PROGRESS",
      assignedTeam: "Lift – Otis AMC",
      aiConfidence: 0.86,
      createdAt: new Date("2026-11-09T09:05:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T12-1102", {
      title: "Lift not working in our tower",
      description: "Lift not working in our tower, stuck since morning.",
      category: "LIFT",
      urgency: "MEDIUM",
      status: "ASSIGNED",
      assignedTeam: "Lift – Otis AMC",
      aiConfidence: 0.81,
      duplicateOfId: lift1.id,
      createdAt: new Date("2026-11-09T14:20:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T12-0603", {
      title: "Lift still not working",
      description: "Lift is still not working since yesterday morning.",
      category: "LIFT",
      urgency: "MEDIUM",
      status: "ASSIGNED",
      assignedTeam: "Lift – Otis AMC",
      aiConfidence: 0.78,
      duplicateOfId: lift1.id,
      createdAt: new Date("2026-11-10T08:40:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T12-1404", {
      title: "Tower lift down again",
      description: "The tower lift is down again, second day now.",
      category: "LIFT",
      urgency: "MEDIUM",
      status: "OPEN",
      aiConfidence: 0.74,
      duplicateOfId: lift1.id,
      createdAt: new Date("2026-11-10T19:15:00Z"),
    }),
  });

  // Safety escalation: the rule engine forces CRITICAL whatever the AI says.
  await prisma.complaint.create({
    data: mk("T21-0302", {
      title: "Lift stuck with people inside",
      description: "Lift stuck with people inside between 3rd and 4th floor, they are shouting for help.",
      category: "LIFT",
      urgency: "CRITICAL",
      status: "IN_PROGRESS",
      assignedTeam: "Lift – Otis AMC + Duty Manager",
      aiConfidence: 0.97,
      createdAt: new Date("2026-11-08T18:30:00Z"),
    }),
  });

  // Swati's water leak (the brief sample row).
  await prisma.complaint.create({
    data: mk("T12-0408", {
      title: "Water leak in bathroom",
      description: "Water leak from the bathroom wall, seepage spreading since two days.",
      category: "PLUMBING",
      urgency: "MEDIUM",
      status: "ASSIGNED",
      assignedTeam: "Plumbing – Ramesh & team",
      aiConfidence: 0.9,
      createdAt: new Date("2026-11-07T11:00:00Z"),
    }),
  });

  // Everyday mix across towers and statuses.
  await prisma.complaint.create({
    data: mk("T07-0502", {
      title: "Bedroom fan not working",
      description: "Bedroom fan and light not switching on since evening.",
      category: "ELECTRICAL",
      urgency: "LOW",
      status: "OPEN",
      aiConfidence: 0.68,
      createdAt: new Date("2026-11-10T20:05:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T07-1203", {
      title: "Main door latch loose",
      description: "Main door latch is loose, door does not close properly.",
      category: "CARPENTRY",
      urgency: "LOW",
      status: "RESOLVED",
      assignedTeam: "Carpentry – Suresh",
      aiConfidence: 0.77,
      rating: 5,
      createdAt: new Date("2026-11-05T10:00:00Z"),
      resolvedAt: new Date("2026-11-06T13:00:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T03-0702", {
      title: "Garbage not collected",
      description: "Garbage not collected near the dustbin for two days, stinking badly.",
      category: "HOUSEKEEPING",
      urgency: "MEDIUM",
      status: "IN_PROGRESS",
      assignedTeam: "Housekeeping – Supervisor",
      aiConfidence: 0.88,
      createdAt: new Date("2026-11-09T07:45:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T18-0601", {
      title: "Stranger loitering near parking",
      description: "A stranger was loitering near the basement parking, guard did not stop him.",
      category: "SECURITY",
      urgency: "HIGH",
      status: "ASSIGNED",
      assignedTeam: "Security – Shift In-charge",
      aiConfidence: 0.83,
      createdAt: new Date("2026-11-10T22:10:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T21-0805", {
      title: "Kitchen tap dripping",
      description: "Kitchen tap dripping continuously, water wasted all day.",
      category: "PLUMBING",
      urgency: "LOW",
      status: "OPEN",
      aiConfidence: 0.85,
      createdAt: new Date("2026-11-11T08:15:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T18-1105", {
      title: "Corridor light flickering",
      description: "Corridor light keeps flickering, maybe a loose wiring issue.",
      category: "ELECTRICAL",
      urgency: "LOW",
      status: "CLOSED",
      assignedTeam: "Electrical – Imran",
      aiConfidence: 0.8,
      rating: 4,
      createdAt: new Date("2026-11-03T19:00:00Z"),
      resolvedAt: new Date("2026-11-04T11:30:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T03-1004", {
      title: "Common area cleaning skipped",
      description: "Lobby cleaning skipped again this week, dust everywhere.",
      category: "HOUSEKEEPING",
      urgency: "LOW",
      status: "OPEN",
      aiConfidence: 0.72,
      createdAt: new Date("2026-11-11T09:30:00Z"),
    }),
  });
  await prisma.complaint.create({
    data: mk("T07-0901", {
      title: "Balcony door hinge broken",
      description: "Balcony door hinge has broken, door is hanging at an angle.",
      category: "CARPENTRY",
      urgency: "MEDIUM",
      status: "ASSIGNED",
      assignedTeam: "Carpentry – Suresh",
      aiConfidence: 0.79,
      createdAt: new Date("2026-11-10T12:25:00Z"),
    }),
  });

  // ── Notices ──────────────────────────────────────────────────────────
  await prisma.notice.createMany({
    data: [
      {
        title: "Water tank cleaning — 14 Nov",
        body: "Overhead tanks will be cleaned on 14 Nov, 9 AM–2 PM. Water supply will pause during cleaning. Please store water in advance.",
        createdAt: new Date("2026-11-08T09:00:00Z"),
      },
      {
        title: "Federation AGM — 29 Nov, Clubhouse",
        body: "The annual general meeting of the residents' federation will be held on 29 Nov at 11 AM in the clubhouse. Agenda and last year's accounts are available at the help desk.",
        createdAt: new Date("2026-11-09T09:00:00Z"),
      },
      {
        title: "Parking sticker audit this week",
        body: "Security will verify parking stickers at all gates this week. Residents without a sticker are requested to collect one from the help desk.",
        createdAt: new Date("2026-11-10T09:00:00Z"),
      },
    ],
  });

  const counts = {
    flats: await prisma.flat.count(),
    users: await prisma.user.count(),
    bills: await prisma.bill.count(),
    payments: await prisma.payment.count(),
    complaints: await prisma.complaint.count(),
    notices: await prisma.notice.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

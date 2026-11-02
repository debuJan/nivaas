import type { ComplaintCategory } from "@prisma/client";

/** Category → the team that gets the work. OTHER waits for a human. */
export const TEAM_BY_CATEGORY: Record<ComplaintCategory, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  LIFT: "Lift Maintenance",
  CARPENTRY: "Carpentry",
  HOUSEKEEPING: "Housekeeping",
  SECURITY: "Security",
  OTHER: "General",
};

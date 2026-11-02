import { PrismaClient } from "@prisma/client";

// Prisma singleton — Next.js dev hot-reloads would otherwise spawn a new
// client (and new SQLite connections) on every change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

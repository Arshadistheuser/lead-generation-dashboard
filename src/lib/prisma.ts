import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // In production (Render), use standard Postgres via DATABASE_URL
  // Locally, use SQLite via better-sqlite3 adapter
  if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL?.startsWith("postgres")) {
    return new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
    });
  }

  // Local development with SQLite
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

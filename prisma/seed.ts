import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("postgres")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  }
  // Local SQLite
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter });
}

const prisma = createClient();

const TEAM_MEMBERS = [
  "Harika",
  "Vivek",
  "Tejaswini",
  "Rishiga",
  "Sowmiya Shankar",
  "Varsha",
  "Kaviya",
  "Sathish",
  "Revathy",
  "Shanmugapriya",
  "Sharmila",
  "Sowmya Hariharan",
  "Keerthana",
  "Sandhiya",
  "Rajalakshmi",
  "Reena Devi",
  "Pachaiyappan",
  "Santhosh Kumar",
];

async function main() {
  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@leadgen.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@leadgen.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  // Create viewer user
  const viewerHash = await bcrypt.hash("viewer123", 10);
  await prisma.user.upsert({
    where: { email: "viewer@leadgen.com" },
    update: {},
    create: {
      name: "Viewer",
      email: "viewer@leadgen.com",
      passwordHash: viewerHash,
      role: "VIEWER",
    },
  });

  // Create team members
  for (const name of TEAM_MEMBERS) {
    await prisma.teamMember.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Seed sample daily entries for the last 7 days
  const members = await prisma.teamMember.findMany();
  const sources = ["ZoomInfo", "HG Insights", "Scraper"];
  const industries = [
    "Manufacturing",
    "CPG",
    "Hi-Tech",
    "Retail",
    "Healthcare",
    "BFSI",
    "Logistics",
  ];
  const techStacks = ["SAP", "MS", "BHL"];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    for (const member of members) {
      const isOnLeave = Math.random() < 0.1;
      await prisma.dailyEntry.upsert({
        where: {
          date_teamMemberId: { date, teamMemberId: member.id },
        },
        update: {},
        create: {
          date,
          teamMemberId: member.id,
          onLeave: isOnLeave,
          accountsResearched: isOnLeave
            ? 0
            : Math.floor(Math.random() * 30) + 10,
          accountsAdded: isOnLeave ? 0 : Math.floor(Math.random() * 10),
          contactsAdded: isOnLeave
            ? 0
            : Math.floor(Math.random() * 40) + 30,
          contactPhoneYes: isOnLeave ? 0 : Math.floor(Math.random() * 20),
          contactPhoneNo: isOnLeave ? 0 : Math.floor(Math.random() * 10),
          meetingsSet: isOnLeave ? 0 : Math.floor(Math.random() * 3),
          source: isOnLeave
            ? null
            : sources[Math.floor(Math.random() * sources.length)],
          industry: isOnLeave
            ? null
            : industries[Math.floor(Math.random() * industries.length)],
          techStack: isOnLeave
            ? null
            : techStacks[Math.floor(Math.random() * techStacks.length)],
        },
      });
    }
  }

  console.log("Seed completed: 2 users, 18 team members, ~126 daily entries");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const TEAM_MEMBERS = [
  "Harika", "Vivek", "Tejaswini", "Rishiga", "Sowmiya Shankar",
  "Varsha", "Kaviya", "Sathish", "Revathy", "Shanmugapriya",
  "Sharmila", "Sowmya Hariharan", "Keerthana", "Sandhiya",
  "Rajalakshmi", "Reena Devi", "Pachaiyappan", "Santhosh Kumar",
];

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-seed-secret");
  if (secret !== process.env.CRON_SECRET && secret !== "seed-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@leadgen.com" },
    update: {},
    create: { name: "Admin", email: "admin@leadgen.com", passwordHash, role: "ADMIN" },
  });

  const viewerHash = await bcrypt.hash("viewer123", 10);
  await prisma.user.upsert({
    where: { email: "viewer@leadgen.com" },
    update: {},
    create: { name: "Viewer", email: "viewer@leadgen.com", passwordHash: viewerHash, role: "VIEWER" },
  });

  for (const name of TEAM_MEMBERS) {
    await prisma.teamMember.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  return NextResponse.json({ success: true, members: TEAM_MEMBERS.length });
}

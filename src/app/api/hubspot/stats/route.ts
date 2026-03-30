import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const latest = await prisma.hubSpotSnapshot.findFirst({
    where: { teamMemberId: null },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(latest);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INDUSTRIES } from "@/lib/constants";

export async function GET() {
  const entries = await prisma.dailyEntry.findMany({
    where: { onLeave: false, industry: { not: null } },
    select: {
      industry: true,
      accountsResearched: true,
      accountsAdded: true,
      contactsAdded: true,
      meetingsSet: true,
    },
  });

  const breakdown = INDUSTRIES.map((industry) => {
    const filtered = entries.filter((e) => e.industry === industry);
    return {
      industry,
      accountsResearched: filtered.reduce((s, e) => s + e.accountsResearched, 0),
      accountsAdded: filtered.reduce((s, e) => s + e.accountsAdded, 0),
      contactsAdded: filtered.reduce((s, e) => s + e.contactsAdded, 0),
      meetingsSet: filtered.reduce((s, e) => s + e.meetingsSet, 0),
      entries: filtered.length,
    };
  }).filter((d) => d.entries > 0);

  return NextResponse.json(breakdown);
}

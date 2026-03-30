import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "30");
  const dateFrom = subDays(new Date(), days);

  const members = await prisma.teamMember.findMany({
    where: { isActive: true },
    include: {
      dailyEntries: {
        where: { date: { gte: dateFrom }, onLeave: false },
        orderBy: { date: "desc" },
      },
    },
  });

  const leaderboard = members
    .map((member) => {
      const entries = member.dailyEntries;
      return {
        id: member.id,
        name: member.name,
        totalAccountsResearched: entries.reduce((s, e) => s + e.accountsResearched, 0),
        totalAccountsAdded: entries.reduce((s, e) => s + e.accountsAdded, 0),
        totalContactsAdded: entries.reduce((s, e) => s + e.contactsAdded, 0),
        totalMeetingsSet: entries.reduce((s, e) => s + e.meetingsSet, 0),
        totalPhoneNumbers: entries.reduce((s, e) => s + e.contactPhoneYes, 0),
        daysWorked: entries.length,
        avgContactsPerDay: entries.length > 0
          ? Math.round(entries.reduce((s, e) => s + e.contactsAdded, 0) / entries.length)
          : 0,
      };
    })
    .sort((a, b) => b.totalContactsAdded - a.totalContactsAdded);

  return NextResponse.json({ leaderboard, days });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get("period") || "weekly";
  const dateStr = searchParams.get("date");
  const referenceDate = dateStr ? new Date(dateStr) : new Date();

  let dateFrom: Date;
  let dateTo: Date;
  let prevFrom: Date;
  let prevTo: Date;

  if (period === "monthly") {
    dateFrom = startOfMonth(referenceDate);
    dateTo = endOfMonth(referenceDate);
    prevFrom = startOfMonth(subMonths(referenceDate, 1));
    prevTo = endOfMonth(subMonths(referenceDate, 1));
  } else {
    dateFrom = startOfWeek(referenceDate, { weekStartsOn: 1 });
    dateTo = endOfWeek(referenceDate, { weekStartsOn: 1 });
    prevFrom = startOfWeek(subWeeks(referenceDate, 1), { weekStartsOn: 1 });
    prevTo = endOfWeek(subWeeks(referenceDate, 1), { weekStartsOn: 1 });
  }

  const [current, previous] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: { date: { gte: dateFrom, lte: dateTo }, onLeave: false },
      include: { teamMember: { select: { name: true } } },
    }),
    prisma.dailyEntry.findMany({
      where: { date: { gte: prevFrom, lte: prevTo }, onLeave: false },
    }),
  ]);

  const aggregate = (entries: Array<{ accountsResearched: number; accountsAdded: number; contactsAdded: number; contactPhoneYes: number; contactPhoneNo: number; meetingsSet: number }>) => ({
    accountsResearched: entries.reduce((s, e) => s + e.accountsResearched, 0),
    accountsAdded: entries.reduce((s, e) => s + e.accountsAdded, 0),
    contactsAdded: entries.reduce((s, e) => s + e.contactsAdded, 0),
    contactPhoneYes: entries.reduce((s, e) => s + e.contactPhoneYes, 0),
    contactPhoneNo: entries.reduce((s, e) => s + e.contactPhoneNo, 0),
    meetingsSet: entries.reduce((s, e) => s + e.meetingsSet, 0),
    totalEntries: entries.length,
  });

  const currentStats = aggregate(current);
  const previousStats = aggregate(previous);

  const pctChange = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

  // Per-member breakdown
  const memberMap = new Map<string, { name: string; entries: typeof current }>();
  for (const entry of current) {
    const existing = memberMap.get(entry.teamMemberId);
    if (existing) {
      existing.entries.push(entry);
    } else {
      memberMap.set(entry.teamMemberId, {
        name: entry.teamMember.name,
        entries: [entry],
      });
    }
  }

  const memberBreakdown = Array.from(memberMap.entries()).map(([id, { name, entries }]) => ({
    id,
    name,
    ...aggregate(entries),
  }));

  return NextResponse.json({
    period,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    current: currentStats,
    previous: previousStats,
    changes: {
      accountsResearched: pctChange(currentStats.accountsResearched, previousStats.accountsResearched),
      accountsAdded: pctChange(currentStats.accountsAdded, previousStats.accountsAdded),
      contactsAdded: pctChange(currentStats.contactsAdded, previousStats.contactsAdded),
      meetingsSet: pctChange(currentStats.meetingsSet, previousStats.meetingsSet),
    },
    memberBreakdown,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dailyEntrySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const memberId = searchParams.get("memberId");
  const industry = searchParams.get("industry");

  const where: Record<string, unknown> = {};

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
  }
  if (memberId) where.teamMemberId = memberId;
  if (industry) where.industry = industry;

  const entries = await prisma.dailyEntry.findMany({
    where,
    include: { teamMember: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { teamMember: { name: "asc" } }],
  });

  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = dailyEntrySchema.parse(body);

    const entry = await prisma.dailyEntry.create({
      data: {
        date: new Date(data.date),
        teamMemberId: data.teamMemberId,
        accountsResearched: data.accountsResearched,
        accountsAdded: data.accountsAdded,
        contactsAdded: data.contactsAdded,
        contactPhoneYes: data.contactPhoneYes,
        contactPhoneNo: data.contactPhoneNo,
        meetingsSet: data.meetingsSet,
        source: data.source ?? null,
        industry: data.industry ?? null,
        techStack: data.techStack ?? null,
        notes: data.notes ?? null,
        onLeave: data.onLeave,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}

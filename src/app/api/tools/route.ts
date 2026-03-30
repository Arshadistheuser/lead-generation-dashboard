import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toolUsageSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
  }

  const usages = await prisma.toolUsage.findMany({
    where,
    include: { teamMember: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  // Aggregate by tool
  const toolSummary = new Map<string, { accountsScraped: number; accountsWorked: number; contactsAdded: number }>();
  for (const u of usages) {
    const existing = toolSummary.get(u.tool) || { accountsScraped: 0, accountsWorked: 0, contactsAdded: 0 };
    existing.accountsScraped += u.accountsScraped;
    existing.accountsWorked += u.accountsWorked;
    existing.contactsAdded += u.contactsAdded;
    toolSummary.set(u.tool, existing);
  }

  return NextResponse.json({
    entries: usages,
    summary: Object.fromEntries(toolSummary),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = toolUsageSchema.parse(body);

    const usage = await prisma.toolUsage.create({
      data: {
        date: new Date(data.date),
        teamMemberId: data.teamMemberId,
        tool: data.tool,
        accountsScraped: data.accountsScraped,
        accountsWorked: data.accountsWorked,
        contactsAdded: data.contactsAdded,
        notes: data.notes ?? null,
      },
    });

    return NextResponse.json(usage, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create tool usage" }, { status: 500 });
  }
}

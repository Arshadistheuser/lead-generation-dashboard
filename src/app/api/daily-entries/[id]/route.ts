import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dailyEntrySchema } from "@/lib/validators";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await prisma.dailyEntry.findUnique({
    where: { id },
    include: { teamMember: { select: { name: true } } },
  });

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = dailyEntrySchema.partial().parse(body);

    const entry = await prisma.dailyEntry.update({
      where: { id },
      data: {
        ...(data.date && { date: new Date(data.date) }),
        ...data,
      },
    });

    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.dailyEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const status = await prisma.hubSpotCacheStatus.findUnique({ where: { id: "singleton" } });
    if (!status) {
      return NextResponse.json({ cached: false, totalCached: 0, syncing: false, lastSyncAt: null });
    }
    return NextResponse.json({
      cached: status.totalCached > 0,
      totalCached: status.totalCached,
      syncing: status.syncing,
      lastSyncAt: status.lastSyncAt,
    });
  } catch {
    return NextResponse.json({ cached: false, totalCached: 0, syncing: false, lastSyncAt: null });
  }
}

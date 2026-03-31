import { NextRequest, NextResponse } from "next/server";
import { matchCompaniesWithHubSpot } from "@/lib/hubspot-matcher";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companies } = body as {
      companies: Array<{
        name: string;
        domain: string;
        industry?: string;
        revenue?: string;
        employees?: string;
        location?: string;
      }>;
    };

    if (!companies || companies.length === 0) {
      return NextResponse.json(
        { error: "No companies provided" },
        { status: 400 }
      );
    }

    // Match with HubSpot
    const matched = await matchCompaniesWithHubSpot(companies);

    const found = matched.filter((m) => m.status === "found").length;
    const notFound = matched.filter((m) => m.status === "not_found").length;
    const possible = matched.filter((m) => m.status === "possible_match").length;

    // Store results in database for viewing in dashboard
    // Use a simple approach — store as a JSON snapshot
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS MatchSession (
          id TEXT PRIMARY KEY,
          results TEXT NOT NULL,
          summary TEXT NOT NULL,
          source TEXT DEFAULT 'extension',
          createdAt TEXT DEFAULT (datetime('now'))
        )`
      );

      const sessionId = `ext_${Date.now()}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO MatchSession (id, results, summary, source) VALUES (?, ?, ?, ?)`,
        sessionId,
        JSON.stringify(matched),
        JSON.stringify({ total: matched.length, found, notFound, possibleMatch: possible }),
        "extension"
      );
    } catch {
      // Non-critical — matching still works even if storage fails
      console.error("Could not store match session");
    }

    return NextResponse.json({
      success: true,
      results: matched,
      summary: {
        total: matched.length,
        found,
        notFound,
        possibleMatch: possible,
      },
    });
  } catch (error) {
    console.error("Extension matcher error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500 }
    );
  }
}

// Allow GET to fetch latest match session
export async function GET() {
  try {
    const sessions = await prisma.$queryRawUnsafe(
      `SELECT * FROM MatchSession ORDER BY createdAt DESC LIMIT 1`
    ) as Array<{ id: string; results: string; summary: string; createdAt: string }>;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ session: null });
    }

    const session = sessions[0];
    return NextResponse.json({
      session: {
        id: session.id,
        results: JSON.parse(session.results),
        summary: JSON.parse(session.summary),
        createdAt: session.createdAt,
      },
    });
  } catch {
    return NextResponse.json({ session: null });
  }
}

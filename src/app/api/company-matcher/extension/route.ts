import { NextRequest, NextResponse } from "next/server";
import { matchCompaniesWithHubSpot } from "@/lib/hubspot-matcher";
import { prisma } from "@/lib/prisma";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companies } = body as {
      companies: Array<{
        name: string;
        domain: string;
        website?: string;
        industry?: string;
        revenue?: string;
        employees?: string;
        location?: string;
      }>;
    };

    if (!companies || companies.length === 0) {
      return NextResponse.json(
        { error: "No companies provided" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const matched = await matchCompaniesWithHubSpot(companies);

    const found = matched.filter((m) => m.status === "found").length;
    const notFound = matched.filter((m) => m.status === "not_found").length;
    const possible = matched.filter((m) => m.status === "possible_match").length;

    const session = {
      results: matched,
      summary: { total: matched.length, found, notFound, possibleMatch: possible },
      createdAt: new Date().toISOString(),
    };

    // Store persistently in Postgres
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MatchSession" (
          "id" TEXT PRIMARY KEY,
          "data" TEXT NOT NULL,
          "createdAt" TIMESTAMP DEFAULT NOW()
        )
      `);

      const id = `session_${Date.now()}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MatchSession" ("id", "data", "createdAt") VALUES ($1, $2, $3)`,
        id,
        JSON.stringify(session),
        new Date().toISOString()
      );
    } catch (e) {
      console.error("Could not save match session:", e);
    }

    return NextResponse.json(
      { success: true, ...session },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Extension matcher error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "data" FROM "MatchSession" ORDER BY "createdAt" DESC LIMIT 1`
    ) as Array<{ data: string }>;

    if (rows && rows.length > 0) {
      const session = JSON.parse(rows[0].data);
      return NextResponse.json({ session }, { headers: corsHeaders() });
    }
  } catch {
    // Table might not exist yet
  }

  return NextResponse.json({ session: null }, { headers: corsHeaders() });
}

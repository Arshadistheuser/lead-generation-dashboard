import { NextRequest, NextResponse } from "next/server";
import { matchCompaniesLocal } from "@/lib/hubspot-matcher-local";
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

    // Check if HubSpot cache exists
    const cacheStatus = await prisma.hubSpotCacheStatus.findUnique({ where: { id: "singleton" } });
    if (!cacheStatus || cacheStatus.totalCached === 0) {
      return NextResponse.json(
        { error: "HubSpot cache is empty. Sync HubSpot data from the Company Matcher page first." },
        { status: 400, headers: corsHeaders() }
      );
    }

    const matched = await matchCompaniesLocal(companies);

    const found = matched.filter((m) => m.status === "found").length;
    const notFound = matched.filter((m) => m.status === "not_found").length;
    const possible = matched.filter((m) => m.status === "possible_match").length;

    const session = {
      results: matched,
      summary: { total: matched.length, found, notFound, possibleMatch: possible },
      createdAt: new Date().toISOString(),
    };

    // Store in database using Prisma model
    try {
      await prisma.matchSession.create({
        data: {
          data: JSON.stringify(session),
          source: "extension",
        },
      });
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
    const latest = await prisma.matchSession.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (latest) {
      const session = JSON.parse(latest.data);
      return NextResponse.json({ session }, { headers: corsHeaders() });
    }
  } catch (e) {
    console.error("Could not read match session:", e);
  }

  return NextResponse.json({ session: null }, { headers: corsHeaders() });
}

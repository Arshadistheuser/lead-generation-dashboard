import { NextRequest, NextResponse } from "next/server";
import { matchCompaniesWithHubSpot } from "@/lib/hubspot-matcher";

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

    return NextResponse.json(
      {
        success: true,
        results: matched,
        summary: {
          total: matched.length,
          found,
          notFound,
          possibleMatch: possible,
        },
      },
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
  return NextResponse.json(
    { status: "ok", message: "Extension API is running" },
    { headers: corsHeaders() }
  );
}

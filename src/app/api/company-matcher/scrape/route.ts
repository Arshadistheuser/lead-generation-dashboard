import { NextRequest, NextResponse } from "next/server";
import { scrapeZoomInfo, type ZoomInfoFilters } from "@/lib/zoominfo-scraper";
import { matchCompaniesWithHubSpot } from "@/lib/hubspot-matcher";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, filters, maxResults } = body as {
      email: string;
      password: string;
      filters: ZoomInfoFilters;
      maxResults?: number;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "ZoomInfo credentials required" },
        { status: 400 }
      );
    }

    const logs: string[] = [];
    const onProgress = (msg: string) => {
      logs.push(msg);
    };

    // Step 1: Scrape ZoomInfo
    const companies = await scrapeZoomInfo(
      email,
      password,
      { ...filters, maxResults: maxResults || 100 },
      onProgress
    );

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        companies: [],
        matched: [],
        logs,
        message: "No companies found with the given filters",
      });
    }

    // Step 2: Match with HubSpot
    logs.push(`Matching ${companies.length} companies against HubSpot...`);
    const matched = await matchCompaniesWithHubSpot(companies, (done, total) => {
      if (done % 10 === 0 || done === total) {
        logs.push(`Matched ${done}/${total}...`);
      }
    });

    const found = matched.filter((m) => m.status === "found").length;
    const notFound = matched.filter((m) => m.status === "not_found").length;
    const possible = matched.filter((m) => m.status === "possible_match").length;

    logs.push(
      `Done: ${found} found in HubSpot, ${notFound} new, ${possible} possible matches`
    );

    return NextResponse.json({
      success: true,
      results: matched,
      summary: { total: matched.length, found, notFound, possibleMatch: possible },
      logs,
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Scraping failed",
        logs: [],
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { matchCompaniesWithHubSpot } from "@/lib/hubspot-matcher";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Parse the Excel/CSV file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // Map columns — try various common column names
    const companies = rows.map((row) => ({
      name: String(
        row["Company Name"] ??
          row["company_name"] ??
          row["Company"] ??
          row["Name"] ??
          row["name"] ??
          ""
      ).trim(),
      domain: String(
        row["Website"] ??
          row["Domain"] ??
          row["website"] ??
          row["domain"] ??
          row["Company Website"] ??
          row["URL"] ??
          ""
      ).trim(),
      industry: String(
        row["Industry"] ??
          row["industry"] ??
          row["Primary Industry"] ??
          ""
      ).trim(),
      revenue: String(
        row["Revenue"] ??
          row["revenue"] ??
          row["Annual Revenue"] ??
          row["Revenue Range"] ??
          ""
      ).trim(),
      employees: String(
        row["Employees"] ??
          row["employees"] ??
          row["Employee Count"] ??
          row["Number of Employees"] ??
          ""
      ).trim(),
      location: String(
        row["Location"] ??
          row["Country"] ??
          row["Headquarters"] ??
          row["City"] ??
          ""
      ).trim(),
    })).filter((c) => c.name || c.domain);

    if (companies.length === 0) {
      return NextResponse.json(
        {
          error:
            "No companies found. Ensure columns include 'Company Name' or 'Domain'.",
        },
        { status: 400 }
      );
    }

    // Match with HubSpot
    const matched = await matchCompaniesWithHubSpot(companies);

    const found = matched.filter((m) => m.status === "found").length;
    const notFound = matched.filter((m) => m.status === "not_found").length;
    const possible = matched.filter((m) => m.status === "possible_match").length;

    return NextResponse.json({
      success: true,
      results: matched,
      summary: { total: matched.length, found, notFound, possibleMatch: possible },
      columns: Object.keys(rows[0] || {}),
    });
  } catch (error) {
    console.error("Upload matcher error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500 }
    );
  }
}

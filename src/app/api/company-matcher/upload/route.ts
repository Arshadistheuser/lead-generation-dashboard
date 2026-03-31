import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { matchCompaniesWithHubSpot } from "@/lib/hubspot-matcher";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // Extract headers
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? "").trim();
    });

    // Extract rows as objects
    const rows: Record<string, unknown>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) rowData[header] = cell.value;
      });
      rows.push(rowData);
    });

    // Map columns
    const companies = rows.map((row) => ({
      name: String(
        row["Company Name"] ?? row["company_name"] ?? row["Company"] ??
        row["Name"] ?? row["name"] ?? ""
      ).trim(),
      domain: String(
        row["Website"] ?? row["Domain"] ?? row["website"] ?? row["domain"] ??
        row["Company Website"] ?? row["URL"] ?? ""
      ).trim(),
      industry: String(row["Industry"] ?? row["industry"] ?? row["Primary Industry"] ?? "").trim(),
      revenue: String(row["Revenue"] ?? row["revenue"] ?? row["Annual Revenue"] ?? "").trim(),
      employees: String(row["Employees"] ?? row["employees"] ?? row["Employee Count"] ?? "").trim(),
      location: String(row["Location"] ?? row["Country"] ?? row["Headquarters"] ?? "").trim(),
    })).filter((c) => c.name || c.domain);

    if (companies.length === 0) {
      return NextResponse.json(
        { error: "No companies found. Ensure columns include 'Company Name' or 'Domain'." },
        { status: 400 }
      );
    }

    const matched = await matchCompaniesWithHubSpot(companies);

    const found = matched.filter((m) => m.status === "found").length;
    const notFound = matched.filter((m) => m.status === "not_found").length;
    const possible = matched.filter((m) => m.status === "possible_match").length;

    return NextResponse.json({
      success: true,
      results: matched,
      summary: { total: matched.length, found, notFound, possibleMatch: possible },
      columns: headers.filter(Boolean),
    });
  } catch (error) {
    console.error("Upload matcher error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500 }
    );
  }
}

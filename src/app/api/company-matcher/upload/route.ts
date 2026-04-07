import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { matchCompaniesWithHubSpot } from "@/lib/hubspot-matcher";
import { prisma } from "@/lib/prisma";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400, headers: corsHeaders() });
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    let rows: Record<string, unknown>[] = [];

    if (fileName.endsWith(".csv")) {
      // Parse CSV
      const text = new TextDecoder().decode(arrayBuffer);
      rows = parseCSV(text);
    } else {
      // Parse XLSX/XLS
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount < 2) {
          return NextResponse.json({ error: "File is empty" }, { status: 400, headers: corsHeaders() });
        }

        const headers: string[] = [];
        sheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value ?? "").trim();
        });

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData: Record<string, unknown> = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) rowData[header] = cell.value;
          });
          rows.push(rowData);
        });
      } catch {
        return NextResponse.json(
          { error: "Could not parse file. Please upload a valid .xlsx or .csv file." },
          { status: 400, headers: corsHeaders() }
        );
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400, headers: corsHeaders() });
    }

    // Map columns — try many common column name variations
    const companies = rows.map((row) => ({
      name: findValue(row, ["Company Name", "company_name", "Company", "Name", "name", "CompanyName", "company name", "COMPANY NAME"]),
      domain: findValue(row, ["Website", "Domain", "website", "domain", "Company Website", "URL", "url", "Web", "web", "Website URL", "WEBSITE"]),
      industry: findValue(row, ["Industry", "industry", "Primary Industry", "Sector", "INDUSTRY"]),
      revenue: findValue(row, ["Revenue", "revenue", "Annual Revenue", "Revenue Range", "REVENUE"]),
      employees: findValue(row, ["Employees", "employees", "Employee Count", "Number of Employees", "Headcount", "EMPLOYEES", "Company Size"]),
      location: findValue(row, ["Location", "Country", "Headquarters", "City", "City, State", "City State", "HQ", "LOCATION", "Address"]),
    })).filter((c) => c.name || c.domain);

    if (companies.length === 0) {
      return NextResponse.json(
        { error: `No companies found. Found columns: ${Object.keys(rows[0] || {}).join(", ")}. Need 'Company Name' or 'Website/Domain'.` },
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

    // Store in database for dashboard display
    try {
      await prisma.matchSession.create({
        data: { data: JSON.stringify(session), source: "upload" },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      { success: true, ...session },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Upload matcher error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matching failed" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

function findValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (h) row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

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

    // Find the "Daily Tracker" sheet
    let sheet = workbook.worksheets.find((ws) =>
      ws.name.toLowerCase().includes("daily")
    );
    if (!sheet) sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "No worksheets found" }, { status: 400 });
    }

    // Extract headers from first row
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? "").trim();
    });

    // Get team members for name matching
    const members = await prisma.teamMember.findMany();
    const memberMap = new Map(
      members.map((m) => [m.name.toLowerCase(), m.id])
    );

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Iterate data rows (skip header)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) rowData[header] = cell.value;
      });

      // Queue row for processing
      processRow(rowData, memberMap, errors).then((result) => {
        if (result === "imported") imported++;
        else skipped++;
      });
    });

    // Process all rows sequentially
    const rowsData: Record<string, unknown>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) rowData[header] = cell.value;
      });
      rowsData.push(rowData);
    });

    for (const rowData of rowsData) {
      const nameField =
        (rowData["Lead Gen Name"] as string) ??
        (rowData["Name"] as string) ??
        (rowData["Team Member"] as string);

      if (!nameField) {
        skipped++;
        continue;
      }

      const memberId = memberMap.get(nameField.trim().toLowerCase());
      if (!memberId) {
        errors.push(`Unknown member: ${nameField}`);
        skipped++;
        continue;
      }

      const rawDate = rowData["Date"];
      let date: Date;
      if (rawDate instanceof Date) {
        date = rawDate;
      } else if (typeof rawDate === "number") {
        date = new Date((rawDate - 25569) * 86400000);
      } else if (rawDate) {
        date = new Date(String(rawDate));
      } else {
        skipped++;
        continue;
      }

      if (isNaN(date.getTime())) {
        errors.push(`Invalid date for ${nameField}`);
        skipped++;
        continue;
      }

      date.setHours(0, 0, 0, 0);

      try {
        await prisma.dailyEntry.upsert({
          where: {
            date_teamMemberId: { date, teamMemberId: memberId },
          },
          update: {
            accountsResearched: Number(rowData["Accounts Researched"] ?? rowData["Accounts researched"] ?? 0),
            accountsAdded: Number(rowData["Accounts Added"] ?? rowData["New Accounts Added"] ?? 0),
            contactsAdded: Number(rowData["Contacts Added"] ?? rowData["Contacts added"] ?? 0),
            contactPhoneYes: Number(rowData["Contact Number Yes"] ?? rowData["Phone Yes"] ?? 0),
            contactPhoneNo: Number(rowData["Contact Number No"] ?? rowData["Phone No"] ?? 0),
            meetingsSet: Number(rowData["Meetings Set"] ?? rowData["Meetings"] ?? 0),
            source: rowData["Source"] ? String(rowData["Source"]) : rowData["Data Source"] ? String(rowData["Data Source"]) : null,
            industry: rowData["Industry"] ? String(rowData["Industry"]) : null,
            techStack: rowData["Tech Stack"] ? String(rowData["Tech Stack"]) : null,
          },
          create: {
            date,
            teamMemberId: memberId,
            accountsResearched: Number(rowData["Accounts Researched"] ?? rowData["Accounts researched"] ?? 0),
            accountsAdded: Number(rowData["Accounts Added"] ?? rowData["New Accounts Added"] ?? 0),
            contactsAdded: Number(rowData["Contacts Added"] ?? rowData["Contacts added"] ?? 0),
            contactPhoneYes: Number(rowData["Contact Number Yes"] ?? rowData["Phone Yes"] ?? 0),
            contactPhoneNo: Number(rowData["Contact Number No"] ?? rowData["Phone No"] ?? 0),
            meetingsSet: Number(rowData["Meetings Set"] ?? rowData["Meetings"] ?? 0),
            source: rowData["Source"] ? String(rowData["Source"]) : rowData["Data Source"] ? String(rowData["Data Source"]) : null,
            industry: rowData["Industry"] ? String(rowData["Industry"]) : null,
            techStack: rowData["Tech Stack"] ? String(rowData["Tech Stack"]) : null,
          },
        });
        imported++;
      } catch (err) {
        errors.push(`Failed to import row for ${nameField}: ${err}`);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { success: false, imported: 0, skipped: 0, errors: ["Failed to parse file"] },
      { status: 500 }
    );
  }
}

async function processRow(
  _rowData: Record<string, unknown>,
  _memberMap: Map<string, string>,
  _errors: string[]
): Promise<"imported" | "skipped"> {
  return "skipped";
}

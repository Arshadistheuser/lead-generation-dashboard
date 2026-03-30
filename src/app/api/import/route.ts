import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer);

    // Find the "Daily Tracker" sheet
    const sheetName =
      workbook.SheetNames.find((n) =>
        n.toLowerCase().includes("daily")
      ) ?? workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    // Get team members for name matching
    const members = await prisma.teamMember.findMany();
    const memberMap = new Map(
      members.map((m) => [m.name.toLowerCase(), m.id])
    );

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      // Try to find team member name
      const nameField =
        (row["Lead Gen Name"] as string) ??
        (row["Name"] as string) ??
        (row["Team Member"] as string);

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

      // Parse date
      const rawDate = row["Date"] as string | number;
      let date: Date;
      if (typeof rawDate === "number") {
        // Excel serial date
        date = new Date((rawDate - 25569) * 86400000);
      } else if (rawDate) {
        date = new Date(rawDate);
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
            accountsResearched: Number(row["Accounts Researched"] ?? row["Accounts researched"] ?? 0),
            accountsAdded: Number(row["Accounts Added"] ?? row["New Accounts Added"] ?? 0),
            contactsAdded: Number(row["Contacts Added"] ?? row["Contacts added"] ?? 0),
            contactPhoneYes: Number(row["Contact Number Yes"] ?? row["Phone Yes"] ?? 0),
            contactPhoneNo: Number(row["Contact Number No"] ?? row["Phone No"] ?? 0),
            meetingsSet: Number(row["Meetings Set"] ?? row["Meetings"] ?? 0),
            source: (row["Source"] as string) ?? (row["Data Source"] as string) ?? null,
            industry: (row["Industry"] as string) ?? null,
            techStack: (row["Tech Stack"] as string) ?? null,
          },
          create: {
            date,
            teamMemberId: memberId,
            accountsResearched: Number(row["Accounts Researched"] ?? row["Accounts researched"] ?? 0),
            accountsAdded: Number(row["Accounts Added"] ?? row["New Accounts Added"] ?? 0),
            contactsAdded: Number(row["Contacts Added"] ?? row["Contacts added"] ?? 0),
            contactPhoneYes: Number(row["Contact Number Yes"] ?? row["Phone Yes"] ?? 0),
            contactPhoneNo: Number(row["Contact Number No"] ?? row["Phone No"] ?? 0),
            meetingsSet: Number(row["Meetings Set"] ?? row["Meetings"] ?? 0),
            source: (row["Source"] as string) ?? (row["Data Source"] as string) ?? null,
            industry: (row["Industry"] as string) ?? null,
            techStack: (row["Tech Stack"] as string) ?? null,
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "weekly";
  const dateStr = searchParams.get("date");
  const referenceDate = dateStr ? new Date(dateStr) : new Date();

  let dateFrom: Date;
  let dateTo: Date;

  if (type === "monthly") {
    dateFrom = startOfMonth(referenceDate);
    dateTo = endOfMonth(referenceDate);
  } else {
    dateFrom = startOfWeek(referenceDate, { weekStartsOn: 1 });
    dateTo = endOfWeek(referenceDate, { weekStartsOn: 1 });
  }

  const entries = await prisma.dailyEntry.findMany({
    where: { date: { gte: dateFrom, lte: dateTo } },
    include: { teamMember: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { teamMember: { name: "asc" } }],
  });

  const workbook = new ExcelJS.Workbook();

  // Summary Sheet
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Team Member", key: "name", width: 20 },
    { header: "Accounts Researched", key: "accountsResearched", width: 20 },
    { header: "Accounts Added", key: "accountsAdded", width: 18 },
    { header: "Contacts Added", key: "contactsAdded", width: 18 },
    { header: "Phone Numbers", key: "phoneNumbers", width: 16 },
    { header: "Meetings Set", key: "meetingsSet", width: 14 },
  ];

  // Aggregate by member
  const memberTotals = new Map<
    string,
    {
      name: string;
      accountsResearched: number;
      accountsAdded: number;
      contactsAdded: number;
      phoneNumbers: number;
      meetingsSet: number;
    }
  >();

  for (const e of entries) {
    const existing = memberTotals.get(e.teamMemberId) ?? {
      name: e.teamMember.name,
      accountsResearched: 0,
      accountsAdded: 0,
      contactsAdded: 0,
      phoneNumbers: 0,
      meetingsSet: 0,
    };
    existing.accountsResearched += e.accountsResearched;
    existing.accountsAdded += e.accountsAdded;
    existing.contactsAdded += e.contactsAdded;
    existing.phoneNumbers += e.contactPhoneYes;
    existing.meetingsSet += e.meetingsSet;
    memberTotals.set(e.teamMemberId, existing);
  }

  for (const t of memberTotals.values()) {
    summary.addRow(t);
  }

  // Style header
  summary.getRow(1).font = { bold: true };
  summary.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF374151" },
  };
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Daily Detail Sheet
  const daily = workbook.addWorksheet("Daily Tracker");
  daily.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Team Member", key: "name", width: 20 },
    { header: "Status", key: "status", width: 10 },
    { header: "Accounts Researched", key: "accountsResearched", width: 20 },
    { header: "Accounts Added", key: "accountsAdded", width: 18 },
    { header: "Contacts Added", key: "contactsAdded", width: 18 },
    { header: "Phone Yes", key: "phoneYes", width: 12 },
    { header: "Phone No", key: "phoneNo", width: 12 },
    { header: "Meetings", key: "meetingsSet", width: 12 },
    { header: "Source", key: "source", width: 14 },
    { header: "Industry", key: "industry", width: 16 },
  ];

  for (const e of entries) {
    daily.addRow({
      date: e.date.toISOString().split("T")[0],
      name: e.teamMember.name,
      status: e.onLeave ? "On Leave" : "Active",
      accountsResearched: e.accountsResearched,
      accountsAdded: e.accountsAdded,
      contactsAdded: e.contactsAdded,
      phoneYes: e.contactPhoneYes,
      phoneNo: e.contactPhoneNo,
      meetingsSet: e.meetingsSet,
      source: e.source ?? "",
      industry: e.industry ?? "",
    });
  }

  daily.getRow(1).font = { bold: true };
  daily.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF374151" },
  };
  daily.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lead-gen-report-${type}.xlsx"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getContactCount,
  getCompanyCount,
  getNewContactsSince,
  getNewCompaniesSince,
  getHubSpotClient,
} from "@/lib/hubspot";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getHubSpotClient();
  if (!client) {
    return NextResponse.json({ error: "HubSpot not configured" }, { status: 200 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [totalContacts, totalCompanies, newContacts, newCompanies] =
      await Promise.all([
        getContactCount(),
        getCompanyCount(),
        getNewContactsSince(yesterday),
        getNewCompaniesSince(yesterday),
      ]);

    await prisma.hubSpotSnapshot.upsert({
      where: {
        date_teamMemberId: { date: today, teamMemberId: null as unknown as string },
      },
      update: {
        totalContacts,
        totalCompanies,
        newContactsToday: newContacts,
        newCompaniesToday: newCompanies,
      },
      create: {
        date: today,
        totalContacts,
        totalCompanies,
        newContactsToday: newContacts,
        newCompaniesToday: newCompanies,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cron HubSpot sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getContactCount,
  getCompanyCount,
  getNewContactsSince,
  getNewCompaniesSince,
  getHubSpotClient,
} from "@/lib/hubspot";

export async function POST() {
  const client = getHubSpotClient();
  if (!client) {
    return NextResponse.json(
      { error: "HubSpot not configured. Set HUBSPOT_ACCESS_TOKEN in .env" },
      { status: 400 }
    );
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

    const snapshot = await prisma.hubSpotSnapshot.upsert({
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

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error) {
    console.error("HubSpot sync error:", error);
    return NextResponse.json(
      { error: "Sync failed. Check your HubSpot token." },
      { status: 500 }
    );
  }
}

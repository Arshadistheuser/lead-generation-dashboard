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

    // Use a fixed ID for the global snapshot (no team member)
    const globalId = `global_${today.toISOString().split("T")[0]}`;

    // Try to find existing, otherwise create
    const existing = await prisma.hubSpotSnapshot.findFirst({
      where: { id: globalId },
    });

    let snapshot;
    if (existing) {
      snapshot = await prisma.hubSpotSnapshot.update({
        where: { id: globalId },
        data: {
          totalContacts,
          totalCompanies,
          newContactsToday: newContacts,
          newCompaniesToday: newCompanies,
        },
      });
    } else {
      snapshot = await prisma.hubSpotSnapshot.create({
        data: {
          id: globalId,
          date: today,
          totalContacts,
          totalCompanies,
          newContactsToday: newContacts,
          newCompaniesToday: newCompanies,
        },
      });
    }

    return NextResponse.json({
      success: true,
      snapshot: {
        totalContacts,
        totalCompanies,
        newContactsToday: newContacts,
        newCompaniesToday: newCompanies,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("HubSpot sync error:", error);
    return NextResponse.json(
      { error: "Sync failed. Check your HubSpot token." },
      { status: 500 }
    );
  }
}

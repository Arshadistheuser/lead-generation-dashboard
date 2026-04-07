import { NextResponse } from "next/server";
import { getHubSpotClient } from "@/lib/hubspot";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300; // 5 minutes for large syncs

export async function POST() {
  const client = getHubSpotClient();
  if (!client) {
    return NextResponse.json({ error: "HubSpot not configured" }, { status: 500 });
  }

  // Check if already syncing
  const status = await prisma.hubSpotCacheStatus.findUnique({ where: { id: "singleton" } });
  if (status?.syncing) {
    return NextResponse.json({ error: "Sync already in progress", status: "syncing" }, { status: 409 });
  }

  // Mark as syncing
  await prisma.hubSpotCacheStatus.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", syncing: true, totalCached: 0 },
    update: { syncing: true },
  });

  try {
    // Fetch ALL companies from HubSpot using pagination
    let after: string | undefined = undefined;
    let totalFetched = 0;
    const BATCH_SIZE = 100;
    const allCompanies: Array<{ id: string; name: string; domain: string; website: string }> = [];

    console.log("[HubSpot Cache] Starting full sync...");

     
    while (true) {
      const page = await client.crm.companies.basicApi.getPage(
        BATCH_SIZE,
        after,
        ["name", "domain", "website"],
        undefined,
        undefined,
        false
      );

      for (const company of page.results) {
        allCompanies.push({
          id: company.id,
          name: (company.properties.name || "").substring(0, 500),
          domain: (company.properties.domain || "").substring(0, 500).toLowerCase(),
          website: (company.properties.website || "").substring(0, 500).toLowerCase(),
        });
      }

      totalFetched += page.results.length;
      console.log(`[HubSpot Cache] Fetched ${totalFetched} companies...`);

      if (page.paging?.next?.after) {
        after = page.paging.next.after;
      } else {
        break;
      }
    }

    console.log(`[HubSpot Cache] Total fetched: ${allCompanies.length}. Writing to DB...`);

    // Clear old cache and insert new data in batches
    await prisma.hubSpotCompanyCache.deleteMany();

    // Insert in batches of 500
    const INSERT_BATCH = 500;
    for (let i = 0; i < allCompanies.length; i += INSERT_BATCH) {
      const batch = allCompanies.slice(i, i + INSERT_BATCH);
      await prisma.hubSpotCompanyCache.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    // Update status
    await prisma.hubSpotCacheStatus.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", totalCached: allCompanies.length, syncing: false, lastSyncAt: new Date() },
      update: { totalCached: allCompanies.length, syncing: false, lastSyncAt: new Date() },
    });

    console.log(`[HubSpot Cache] Sync complete. ${allCompanies.length} companies cached.`);

    return NextResponse.json({
      success: true,
      totalCached: allCompanies.length,
    });
  } catch (error) {
    console.error("[HubSpot Cache] Sync failed:", error);

    // Mark as not syncing
    await prisma.hubSpotCacheStatus.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", syncing: false, totalCached: 0 },
      update: { syncing: false },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

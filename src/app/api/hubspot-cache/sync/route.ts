import { NextResponse } from "next/server";
import { getHubSpotClient } from "@/lib/hubspot";
import { prisma } from "@/lib/prisma";

// Background sync — fires and forgets so the HTTP response returns immediately
async function syncInBackground() {
  const client = getHubSpotClient();
  if (!client) return;

  try {
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

      // Update progress every 1000 companies
      if (totalFetched % 1000 < BATCH_SIZE) {
        console.log(`[HubSpot Cache] Fetched ${totalFetched} companies...`);
        await prisma.hubSpotCacheStatus.update({
          where: { id: "singleton" },
          data: { totalCached: totalFetched },
        });
      }

      if (page.paging?.next?.after) {
        after = page.paging.next.after;
      } else {
        break;
      }
    }

    console.log(`[HubSpot Cache] Total fetched: ${allCompanies.length}. Writing to DB...`);

    // Clear old cache and insert new data in batches
    await prisma.hubSpotCompanyCache.deleteMany();

    const INSERT_BATCH = 500;
    for (let i = 0; i < allCompanies.length; i += INSERT_BATCH) {
      const batch = allCompanies.slice(i, i + INSERT_BATCH);
      await prisma.hubSpotCompanyCache.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    await prisma.hubSpotCacheStatus.update({
      where: { id: "singleton" },
      data: { totalCached: allCompanies.length, syncing: false, lastSyncAt: new Date() },
    });

    console.log(`[HubSpot Cache] Sync complete. ${allCompanies.length} companies cached.`);
  } catch (error) {
    console.error("[HubSpot Cache] Sync failed:", error);
    await prisma.hubSpotCacheStatus.update({
      where: { id: "singleton" },
      data: { syncing: false },
    }).catch(() => {});
  }
}

export async function POST() {
  const client = getHubSpotClient();
  if (!client) {
    return NextResponse.json({ error: "HubSpot not configured" }, { status: 500 });
  }

  // Check if already syncing
  const status = await prisma.hubSpotCacheStatus.findUnique({ where: { id: "singleton" } });
  if (status?.syncing) {
    return NextResponse.json({ message: "Sync already in progress", syncing: true });
  }

  // Mark as syncing
  await prisma.hubSpotCacheStatus.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", syncing: true, totalCached: 0 },
    update: { syncing: true, totalCached: 0 },
  });

  // Fire and forget — don't await
  syncInBackground();

  // Return immediately
  return NextResponse.json({ message: "Sync started", syncing: true });
}

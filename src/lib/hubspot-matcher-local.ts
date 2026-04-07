import { prisma } from "./prisma";
import * as fuzzball from "fuzzball";

export interface MatchResult {
  name: string;
  domain: string;
  industry: string;
  revenue: string;
  employees: string;
  location: string;
  status: "found" | "not_found" | "possible_match";
  matchConfidence?: number;
  matchedBy?: string;
  hubspotId?: string;
  hubspotName?: string;
  hubspotDomain?: string;
}

/**
 * Match companies against the local HubSpot cache in Postgres.
 * No HubSpot API calls — all matching is done locally.
 */
export async function matchCompaniesLocal(
  companies: Array<{
    name: string;
    domain: string;
    website?: string;
    industry?: string;
    revenue?: string;
    employees?: string;
    location?: string;
  }>,
  onProgress?: (done: number, total: number) => void
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    onProgress?.(i + 1, companies.length);

    let status: MatchResult["status"] = "not_found";
    let matchConfidence = 0;
    let matchedBy = "";
    let hubspotId: string | undefined;
    let hubspotName: string | undefined;
    let hubspotDomain: string | undefined;

    const domain = cleanDomain(company.domain);
    const websiteDomain = company.website ? cleanDomain(company.website) : "";

    try {
      // Strategy 1: Exact domain match
      if (domain) {
        const match = await prisma.hubSpotCompanyCache.findFirst({
          where: { domain },
        });
        if (match) {
          status = "found";
          matchConfidence = 100;
          matchedBy = "domain";
          hubspotId = match.id;
          hubspotName = match.name;
          hubspotDomain = match.domain;
        }
      }

      // Strategy 2: Match by website domain (if different)
      if (status === "not_found" && websiteDomain && websiteDomain !== domain) {
        const match = await prisma.hubSpotCompanyCache.findFirst({
          where: { domain: websiteDomain },
        });
        if (match) {
          status = "found";
          matchConfidence = 100;
          matchedBy = "website";
          hubspotId = match.id;
          hubspotName = match.name;
          hubspotDomain = match.domain;
        }
      }

      // Strategy 3: Domain contained in website field
      if (status === "not_found" && (domain || websiteDomain)) {
        const searchDomain = domain || websiteDomain;
        const match = await prisma.hubSpotCompanyCache.findFirst({
          where: {
            OR: [
              { website: { contains: searchDomain, mode: "insensitive" } },
              { domain: { contains: searchDomain, mode: "insensitive" } },
            ],
          },
        });
        if (match) {
          status = "found";
          matchConfidence = 95;
          matchedBy = "hubspot_website";
          hubspotId = match.id;
          hubspotName = match.name;
          hubspotDomain = match.domain;
        }
      }

      // Strategy 4: Fuzzy name match
      if (status === "not_found" && company.name) {
        const searchToken = getSearchToken(company.name);
        if (searchToken) {
          // Find candidates whose name contains the primary keyword
          const candidates = await prisma.hubSpotCompanyCache.findMany({
            where: { name: { contains: searchToken, mode: "insensitive" } },
            take: 20,
          });

          if (candidates.length > 0) {
            const best = findBestMatch(
              company.name,
              candidates.map((c) => ({ id: c.id, name: c.name, domain: c.domain }))
            );
            if (best) {
              status = best.score >= 90 ? "found" : "possible_match";
              matchConfidence = best.score;
              matchedBy = "name";
              hubspotId = best.id;
              hubspotName = best.name;
              hubspotDomain = best.domain;
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error matching ${company.name}:`, error);
    }

    results.push({
      name: company.name,
      domain: company.domain,
      industry: company.industry || "",
      revenue: company.revenue || "",
      employees: company.employees || "",
      location: company.location || "",
      status,
      matchConfidence,
      matchedBy,
      hubspotId,
      hubspotName,
      hubspotDomain,
    });
  }

  return results;
}

function cleanDomain(raw: string): string {
  if (!raw) return "";
  let domain = raw.toLowerCase().trim();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/^www\./, "");
  domain = domain.replace(/\/.*$/, "");
  domain = domain.replace(/[?#].*$/, "");
  return domain;
}

function getSearchToken(name: string): string {
  const skipWords = new Set([
    "the", "inc", "llc", "ltd", "corp", "corporation", "company",
    "co", "group", "holdings", "international", "global", "services",
    "solutions", "technologies", "systems",
  ]);

  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !skipWords.has(w));

  return words[0] || name.split(" ")[0];
}

function findBestMatch(
  searchName: string,
  candidates: Array<{ id: string; name: string; domain: string }>
): { id: string; name: string; domain: string; score: number } | null {
  if (candidates.length === 0) return null;

  let bestScore = 0;
  let bestCandidate = candidates[0];

  for (const candidate of candidates) {
    const score = fuzzball.token_set_ratio(
      searchName.toLowerCase(),
      candidate.name.toLowerCase()
    );
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (bestScore < 60) return null;
  return { ...bestCandidate, score: bestScore };
}

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
 * Match companies against local HubSpot cache using BULK queries.
 * Instead of 4 queries per company, we do 2-3 queries TOTAL.
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
  }>
): Promise<MatchResult[]> {
  // Step 1: Clean all domains upfront
  const companiesWithClean = companies.map((c) => ({
    ...c,
    cleanDomain: cleanDomain(c.domain),
    cleanWebsite: c.website ? cleanDomain(c.website) : "",
  }));

  // Step 2: Collect ALL unique domains to search (one big query)
  const allDomains = new Set<string>();
  for (const c of companiesWithClean) {
    if (c.cleanDomain) allDomains.add(c.cleanDomain);
    if (c.cleanWebsite) allDomains.add(c.cleanWebsite);
  }

  // Step 3: SINGLE query — fetch all HubSpot companies matching ANY of these domains
  const domainMatches = allDomains.size > 0
    ? await prisma.hubSpotCompanyCache.findMany({
        where: { domain: { in: Array.from(allDomains) } },
      })
    : [];

  // Build domain → match lookup
  const domainMap = new Map<string, { id: string; name: string; domain: string }>();
  for (const m of domainMatches) {
    if (m.domain && !domainMap.has(m.domain)) {
      domainMap.set(m.domain, { id: m.id, name: m.name, domain: m.domain });
    }
  }

  // Step 4: For unmatched companies, try name-based search
  // Collect search tokens for companies that didn't match by domain
  const unmatchedByName: Array<{ index: number; name: string; token: string }> = [];
  const resultMap = new Map<number, Partial<MatchResult>>();

  for (let i = 0; i < companiesWithClean.length; i++) {
    const c = companiesWithClean[i];

    // Try domain match first
    const domainHit = domainMap.get(c.cleanDomain) || (c.cleanWebsite ? domainMap.get(c.cleanWebsite) : null);
    if (domainHit) {
      resultMap.set(i, {
        status: "found",
        matchConfidence: 100,
        matchedBy: "domain",
        hubspotId: domainHit.id,
        hubspotName: domainHit.name,
        hubspotDomain: domainHit.domain,
      });
      continue;
    }

    // Queue for name matching
    if (c.name) {
      const token = getSearchToken(c.name);
      if (token) {
        unmatchedByName.push({ index: i, name: c.name, token });
      }
    }
  }

  // Step 5: Batch name matching — one query per unique token (deduplicated)
  if (unmatchedByName.length > 0) {
    const uniqueTokens = [...new Set(unmatchedByName.map((u) => u.token))];

    // Single query: get all candidates whose name contains any of our tokens
    // Postgres doesn't support OR-based ILIKE in a single `in`, so use OR conditions
    const nameCandidates = await prisma.hubSpotCompanyCache.findMany({
      where: {
        OR: uniqueTokens.map((token) => ({
          name: { contains: token, mode: "insensitive" as const },
        })),
      },
      take: 2000, // cap to avoid memory issues
    });

    // For each unmatched company, fuzzy match against candidates containing their token
    for (const item of unmatchedByName) {
      if (resultMap.has(item.index)) continue; // already matched

      const tokenLower = item.token.toLowerCase();
      const relevant = nameCandidates.filter((c) =>
        c.name.toLowerCase().includes(tokenLower)
      );

      if (relevant.length === 0) continue;

      const best = findBestMatch(
        item.name,
        relevant.map((c) => ({ id: c.id, name: c.name, domain: c.domain }))
      );

      if (best) {
        resultMap.set(item.index, {
          status: best.score >= 90 ? "found" : "possible_match",
          matchConfidence: best.score,
          matchedBy: "name",
          hubspotId: best.id,
          hubspotName: best.name,
          hubspotDomain: best.domain,
        });
      }
    }
  }

  // Step 6: Build final results
  return companies.map((company, i) => {
    const match = resultMap.get(i);
    return {
      name: company.name,
      domain: company.domain,
      industry: company.industry || "",
      revenue: company.revenue || "",
      employees: company.employees || "",
      location: company.location || "",
      status: match?.status || "not_found",
      matchConfidence: match?.matchConfidence || 0,
      matchedBy: match?.matchedBy || "",
      hubspotId: match?.hubspotId,
      hubspotName: match?.hubspotName,
      hubspotDomain: match?.hubspotDomain,
    };
  });
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

import { getHubSpotClient } from "./hubspot";
import Bottleneck from "bottleneck";
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
  hubspotId?: string;
  hubspotName?: string;
  hubspotDomain?: string;
}

// HubSpot rate limit: 100 requests per 10 seconds
const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 120, // ~8 req/sec to stay safely under 10/sec
});

export async function matchCompaniesWithHubSpot(
  companies: Array<{
    name: string;
    domain: string;
    industry?: string;
    revenue?: string;
    employees?: string;
    location?: string;
  }>,
  onProgress?: (done: number, total: number) => void
): Promise<MatchResult[]> {
  const client = getHubSpotClient();
  if (!client) {
    throw new Error("HubSpot not configured. Set HUBSPOT_ACCESS_TOKEN in .env");
  }

  const results: MatchResult[] = [];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    onProgress?.(i + 1, companies.length);

    let status: MatchResult["status"] = "not_found";
    let matchConfidence = 0;
    let hubspotId: string | undefined;
    let hubspotName: string | undefined;
    let hubspotDomain: string | undefined;

    const domain = cleanDomain(company.domain);

    try {
      // Strategy 1: Search by domain (most reliable)
      if (domain) {
        const domainResult = await limiter.schedule(() =>
          client.crm.companies.searchApi.doSearch({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: "domain",
                    operator: "EQ",
                    value: domain,
                  },
                ],
              },
            ],
            properties: ["name", "domain", "industry"],
            limit: 1,
            after: "0",
            sorts: [],
          } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        );

        if (domainResult.total > 0) {
          const match = domainResult.results[0];
          status = "found";
          matchConfidence = 100;
          hubspotId = match.id;
          hubspotName = match.properties.name || undefined;
          hubspotDomain = match.properties.domain || undefined;
        }
      }

      // Strategy 2: Fuzzy name match if no domain match
      if (status === "not_found" && company.name) {
        const nameResult = await limiter.schedule(() =>
          client.crm.companies.searchApi.doSearch({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: "name",
                    operator: "CONTAINS_TOKEN",
                    value: getSearchToken(company.name),
                  },
                ],
              },
            ],
            properties: ["name", "domain", "industry"],
            limit: 10,
            after: "0",
            sorts: [],
          } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        );

        if (nameResult.total > 0) {
          // Use fuzzball to find the best match
          const candidates = nameResult.results.map((r) => ({
            id: r.id,
            name: r.properties.name || "",
            domain: r.properties.domain || "",
          }));

          const bestMatch = findBestMatch(company.name, candidates);

          if (bestMatch) {
            if (bestMatch.score >= 90) {
              status = "found";
              matchConfidence = bestMatch.score;
            } else if (bestMatch.score >= 65) {
              status = "possible_match";
              matchConfidence = bestMatch.score;
            }

            if (status !== "not_found") {
              hubspotId = bestMatch.id;
              hubspotName = bestMatch.name;
              hubspotDomain = bestMatch.domain;
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
  return domain;
}

function getSearchToken(name: string): string {
  // Get the most significant word from company name (skip common words)
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
    // Use token_set_ratio — handles word order differences and extra words
    // e.g., "Acme Corp" vs "Acme Corporation Inc" → high score
    const score = fuzzball.token_set_ratio(
      searchName.toLowerCase(),
      candidate.name.toLowerCase()
    );

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return { ...bestCandidate, score: bestScore };
}

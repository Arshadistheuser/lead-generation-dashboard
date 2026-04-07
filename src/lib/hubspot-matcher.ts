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
  matchedBy?: string;
  hubspotId?: string;
  hubspotName?: string;
  hubspotDomain?: string;
}

// HubSpot rate limit: 100 requests per 10 seconds
// Use 10 concurrent with 50ms gap = ~20 req/sec (well under limit)
const limiter = new Bottleneck({
  maxConcurrent: 10,
  minTime: 50,
});

export async function matchCompaniesWithHubSpot(
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
    let matchedBy = "";
    let hubspotId: string | undefined;
    let hubspotName: string | undefined;
    let hubspotDomain: string | undefined;

    const domain = cleanDomain(company.domain);
    const websiteDomain = company.website ? cleanDomain(company.website) : "";

    try {
      // ── Strategy 1: Match by company domain ──
      if (domain) {
        const result = await searchByDomain(client, domain);
        if (result) {
          status = "found";
          matchConfidence = 100;
          matchedBy = "domain";
          hubspotId = result.id;
          hubspotName = result.name;
          hubspotDomain = result.domain;
        }
      }

      // ── Strategy 2: Match by website domain (if different from company domain) ──
      if (status === "not_found" && websiteDomain && websiteDomain !== domain) {
        const result = await searchByDomain(client, websiteDomain);
        if (result) {
          status = "found";
          matchConfidence = 100;
          matchedBy = "website";
          hubspotId = result.id;
          hubspotName = result.name;
          hubspotDomain = result.domain;
        }
      }

      // ── Strategy 3: Match by website property in HubSpot ──
      if (status === "not_found" && (domain || websiteDomain)) {
        const searchDomain = domain || websiteDomain;
        const result = await searchByWebsite(client, searchDomain);
        if (result) {
          status = "found";
          matchConfidence = 95;
          matchedBy = "hubspot_website";
          hubspotId = result.id;
          hubspotName = result.name;
          hubspotDomain = result.domain;
        }
      }

      // ── Strategy 4: Match by company name (fuzzy) ──
      if (status === "not_found" && company.name) {
        const nameResult = await searchByName(client, company.name);
        if (nameResult) {
          status = nameResult.score >= 90 ? "found" : "possible_match";
          matchConfidence = nameResult.score;
          matchedBy = "name";
          hubspotId = nameResult.id;
          hubspotName = nameResult.name;
          hubspotDomain = nameResult.domain;
        }
      }

      // Strategy 5 removed — too slow for batch matching
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

// Search HubSpot by domain property
async function searchByDomain(client: ReturnType<typeof getHubSpotClient>, domain: string) {
  if (!client) return null;
  const result = await limiter.schedule(() =>
    client.crm.companies.searchApi.doSearch({
      filterGroups: [
        { filters: [{ propertyName: "domain", operator: "EQ", value: domain }] },
      ],
      properties: ["name", "domain", "website", "industry"],
      limit: 1,
      after: "0",
      sorts: [],
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  );

  if (result.total > 0) {
    const match = result.results[0];
    return { id: match.id, name: match.properties.name || "", domain: match.properties.domain || "" };
  }
  return null;
}

// Search HubSpot by website property (contains the domain)
async function searchByWebsite(client: ReturnType<typeof getHubSpotClient>, domain: string) {
  if (!client) return null;
  const result = await limiter.schedule(() =>
    client.crm.companies.searchApi.doSearch({
      filterGroups: [
        { filters: [{ propertyName: "website", operator: "CONTAINS_TOKEN", value: domain.split(".")[0] }] },
      ],
      properties: ["name", "domain", "website", "industry"],
      limit: 5,
      after: "0",
      sorts: [],
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  );

  if (result.total > 0) {
    // Check if any result's website contains our domain
    for (const match of result.results) {
      const hsWebsite = cleanDomain(match.properties.website || "");
      const hsDomain = cleanDomain(match.properties.domain || "");
      if (hsWebsite.includes(domain) || domain.includes(hsWebsite) ||
          hsDomain.includes(domain) || domain.includes(hsDomain)) {
        return { id: match.id, name: match.properties.name || "", domain: match.properties.domain || "" };
      }
    }
  }
  return null;
}

// Search HubSpot by company name with fuzzy matching
async function searchByName(client: ReturnType<typeof getHubSpotClient>, name: string) {
  if (!client) return null;
  const searchToken = getSearchToken(name);
  if (!searchToken) return null;

  const result = await limiter.schedule(() =>
    client.crm.companies.searchApi.doSearch({
      filterGroups: [
        { filters: [{ propertyName: "name", operator: "CONTAINS_TOKEN", value: searchToken }] },
      ],
      properties: ["name", "domain", "website", "industry"],
      limit: 10,
      after: "0",
      sorts: [],
    } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  );

  if (result.total > 0) {
    return findBestMatch(name, result.results.map((r) => ({
      id: r.id,
      name: r.properties.name || "",
      domain: r.properties.domain || "",
    })));
  }
  return null;
}

// Search by "Company Name - Lead Gen" custom property
async function searchByLeadGenName(client: ReturnType<typeof getHubSpotClient>, name: string) {
  if (!client) return null;
  const searchToken = getSearchToken(name);
  if (!searchToken) return null;

  try {
    const result = await limiter.schedule(() =>
      client.crm.companies.searchApi.doSearch({
        filterGroups: [
          { filters: [{ propertyName: "company_name___lead_gen", operator: "CONTAINS_TOKEN", value: searchToken }] },
        ],
        properties: ["name", "domain", "website", "company_name___lead_gen"],
        limit: 10,
        after: "0",
        sorts: [],
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    if (result.total > 0) {
      return findBestMatch(name, result.results.map((r) => ({
        id: r.id,
        name: r.properties.company_name___lead_gen || r.properties.name || "",
        domain: r.properties.domain || "",
      })));
    }
  } catch {
    // Property might not exist — that's fine, skip this strategy
  }
  return null;
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

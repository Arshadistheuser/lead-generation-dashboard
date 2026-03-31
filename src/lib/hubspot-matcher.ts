import { getHubSpotClient } from "./hubspot";

export interface MatchResult {
  name: string;
  domain: string;
  industry: string;
  revenue: string;
  employees: string;
  location: string;
  status: "found" | "not_found" | "possible_match";
  hubspotId?: string;
  hubspotName?: string;
  hubspotDomain?: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    let hubspotId: string | undefined;
    let hubspotName: string | undefined;
    let hubspotDomain: string | undefined;

    // Clean domain for search
    const domain = cleanDomain(company.domain);

    try {
      // Strategy 1: Search by domain (most reliable)
      if (domain) {
        const domainResult = await client.crm.companies.searchApi.doSearch({
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
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        if (domainResult.total > 0) {
          const match = domainResult.results[0];
          status = "found";
          hubspotId = match.id;
          hubspotName = match.properties.name || undefined;
          hubspotDomain = match.properties.domain || undefined;
        }
      }

      // Strategy 2: If no domain match, try company name
      if (status === "not_found" && company.name) {
        const nameResult = await client.crm.companies.searchApi.doSearch({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "name",
                  operator: "CONTAINS_TOKEN",
                  value: company.name.split(" ")[0], // Search first word
                },
              ],
            },
          ],
          properties: ["name", "domain", "industry"],
          limit: 5,
          after: "0",
          sorts: [],
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        if (nameResult.total > 0) {
          // Check for exact or close name match
          for (const match of nameResult.results) {
            const matchName = (match.properties.name || "").toLowerCase();
            const searchName = company.name.toLowerCase();

            if (matchName === searchName) {
              status = "found";
              hubspotId = match.id;
              hubspotName = match.properties.name || undefined;
              hubspotDomain = match.properties.domain || undefined;
              break;
            } else if (
              matchName.includes(searchName) ||
              searchName.includes(matchName)
            ) {
              status = "possible_match";
              hubspotId = match.id;
              hubspotName = match.properties.name || undefined;
              hubspotDomain = match.properties.domain || undefined;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error matching ${company.name}:`, error);
      // Continue with not_found status
    }

    results.push({
      name: company.name,
      domain: company.domain,
      industry: company.industry || "",
      revenue: company.revenue || "",
      employees: company.employees || "",
      location: company.location || "",
      status,
      hubspotId,
      hubspotName,
      hubspotDomain,
    });

    // Rate limit: 100ms between calls to stay within HubSpot limits
    await delay(100);
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

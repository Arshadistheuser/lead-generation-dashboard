import { Client } from "@hubspot/api-client";

let hubspotClient: Client | null = null;

export function getHubSpotClient(): Client | null {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return null;

  if (!hubspotClient) {
    hubspotClient = new Client({ accessToken: token, numberOfApiCallRetries: 2 });
  }
  return hubspotClient;
}

// Use type assertion to work around strict enum typing in HubSpot SDK
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getContactCount(): Promise<number> {
  const client = getHubSpotClient();
  if (!client) return 0;

  const result = await client.crm.contacts.searchApi.doSearch({
    filterGroups: [],
    limit: 1,
    after: "0",
    sorts: [],
    properties: [],
  } as any);
  return result.total;
}

export async function getCompanyCount(): Promise<number> {
  const client = getHubSpotClient();
  if (!client) return 0;

  const result = await client.crm.companies.searchApi.doSearch({
    filterGroups: [],
    limit: 1,
    after: "0",
    sorts: [],
    properties: [],
  } as any);
  return result.total;
}

export async function getNewContactsSince(since: Date): Promise<number> {
  const client = getHubSpotClient();
  if (!client) return 0;

  const result = await client.crm.contacts.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "createdate",
            operator: "GTE",
            value: since.getTime().toString(),
          },
        ],
      },
    ],
    limit: 1,
    after: "0",
    sorts: [],
    properties: [],
  } as any);
  return result.total;
}

export async function getNewCompaniesSince(since: Date): Promise<number> {
  const client = getHubSpotClient();
  if (!client) return 0;

  const result = await client.crm.companies.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "createdate",
            operator: "GTE",
            value: since.getTime().toString(),
          },
        ],
      },
    ],
    limit: 1,
    after: "0",
    sorts: [],
    properties: [],
  } as any);
  return result.total;
}

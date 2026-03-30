import { z } from "zod";
import { INDUSTRIES, DATA_SOURCES, TECH_STACKS } from "./constants";

export const dailyEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teamMemberId: z.string().min(1),
  accountsResearched: z.coerce.number().int().min(0).default(0),
  accountsAdded: z.coerce.number().int().min(0).default(0),
  contactsAdded: z.coerce.number().int().min(0).default(0),
  contactPhoneYes: z.coerce.number().int().min(0).default(0),
  contactPhoneNo: z.coerce.number().int().min(0).default(0),
  meetingsSet: z.coerce.number().int().min(0).default(0),
  source: z.enum(DATA_SOURCES as unknown as [string, ...string[]]).nullable().optional(),
  industry: z.enum(INDUSTRIES as unknown as [string, ...string[]]).nullable().optional(),
  techStack: z.enum(TECH_STACKS as unknown as [string, ...string[]]).nullable().optional(),
  notes: z.string().nullable().optional(),
  onLeave: z.boolean().default(false),
});

export const toolUsageSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teamMemberId: z.string().min(1),
  tool: z.enum(["ZOOMINFO", "HG_INSIGHTS", "SCRAPER"]),
  accountsScraped: z.coerce.number().int().min(0).default(0),
  accountsWorked: z.coerce.number().int().min(0).default(0),
  contactsAdded: z.coerce.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type DailyEntryInput = z.infer<typeof dailyEntrySchema>;
export type ToolUsageInput = z.infer<typeof toolUsageSchema>;

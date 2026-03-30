"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/shared/chart-container";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton, ChartSkeleton } from "@/components/shared/loading-skeleton";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { INDUSTRIES } from "@/lib/constants";

interface DailyEntry {
  industry: string | null;
  contactsAdded: number;
  accountsResearched: number;
  accountsAdded: number;
  meetingsSet: number;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210 60% 50%)",
  "hsl(150 60% 40%)",
  "hsl(30 80% 55%)",
  "hsl(330 70% 50%)",
  "hsl(270 50% 50%)",
  "hsl(180 50% 45%)",
];

interface IndustryData {
  industry: string;
  contacts: number;
  accounts: number;
  accountsAdded: number;
  meetings: number;
}

const columns: ColumnDef<IndustryData>[] = [
  { accessorKey: "industry", header: "Industry" },
  {
    accessorKey: "accounts",
    header: "Researched",
    cell: ({ row }) => <span className="font-mono">{row.getValue("accounts")}</span>,
  },
  {
    accessorKey: "accountsAdded",
    header: "Added",
    cell: ({ row }) => <span className="font-mono">{row.getValue("accountsAdded")}</span>,
  },
  {
    accessorKey: "contacts",
    header: "Contacts",
    cell: ({ row }) => <span className="font-mono">{row.getValue("contacts")}</span>,
  },
  {
    accessorKey: "meetings",
    header: "Meetings",
    cell: ({ row }) => <span className="font-mono">{row.getValue("meetings")}</span>,
  },
];

export default function IndustriesPage() {
  const { data: entries, isLoading } = useQuery<DailyEntry[]>({
    queryKey: ["daily-entries-all"],
    queryFn: () => fetch("/api/daily-entries").then((r) => r.json()),
  });

  const industryData: IndustryData[] = INDUSTRIES.map((ind) => {
    const filtered = entries?.filter((e) => e.industry === ind) ?? [];
    return {
      industry: ind,
      contacts: filtered.reduce((s, e) => s + e.contactsAdded, 0),
      accounts: filtered.reduce((s, e) => s + e.accountsResearched, 0),
      accountsAdded: filtered.reduce((s, e) => s + e.accountsAdded, 0),
      meetings: filtered.reduce((s, e) => s + e.meetingsSet, 0),
    };
  })
    .filter((d) => d.contacts > 0 || d.accounts > 0)
    .sort((a, b) => b.contacts - a.contacts);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Contacts by Industry
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ChartContainer height={300}>
                  <PieChart>
                    <Pie
                      data={industryData}
                      dataKey="contacts"
                      nameKey="industry"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={(props) =>
                        `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                      fontSize={10}
                    >
                      {industryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Accounts Researched by Industry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer height={300}>
                  <BarChart data={industryData} layout="vertical">
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      dataKey="industry"
                      type="category"
                      width={100}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="accounts"
                      fill="hsl(var(--chart-2))"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Industry Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} />
          ) : (
            <DataTable columns={columns} data={industryData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

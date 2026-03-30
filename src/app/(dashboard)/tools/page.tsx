"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton, KpiCardSkeleton } from "@/components/shared/loading-skeleton";
import { ChartContainer } from "@/components/shared/chart-container";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { TOOLS } from "@/lib/constants";

interface ToolEntry {
  id: string;
  date: string;
  tool: string;
  accountsScraped: number;
  accountsWorked: number;
  contactsAdded: number;
  teamMember: { name: string };
}

interface ToolData {
  entries: ToolEntry[];
  summary: Record<string, { accountsScraped: number; accountsWorked: number; contactsAdded: number }>;
}

const columns: ColumnDef<ToolEntry>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {format(new Date(row.getValue("date")), "MMM dd, yyyy")}
      </span>
    ),
  },
  {
    accessorKey: "teamMember.name",
    header: "Member",
    cell: ({ row }) => row.original.teamMember.name,
  },
  {
    accessorKey: "tool",
    header: "Tool",
    cell: ({ row }) => TOOLS.find((t) => t.id === row.getValue("tool"))?.label ?? row.getValue("tool"),
  },
  {
    accessorKey: "accountsScraped",
    header: "Scraped",
    cell: ({ row }) => <span className="font-mono">{row.getValue("accountsScraped")}</span>,
  },
  {
    accessorKey: "accountsWorked",
    header: "Worked",
    cell: ({ row }) => <span className="font-mono">{row.getValue("accountsWorked")}</span>,
  },
  {
    accessorKey: "contactsAdded",
    header: "Contacts",
    cell: ({ row }) => <span className="font-mono">{row.getValue("contactsAdded")}</span>,
  },
];

export default function ToolsPage() {
  const { data, isLoading } = useQuery<ToolData>({
    queryKey: ["tools"],
    queryFn: () => fetch("/api/tools").then((r) => r.json()),
  });

  const chartData = TOOLS.map((tool) => ({
    name: tool.label,
    scraped: data?.summary[tool.id]?.accountsScraped ?? 0,
    worked: data?.summary[tool.id]?.accountsWorked ?? 0,
    contacts: data?.summary[tool.id]?.contactsAdded ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          TOOLS.map((tool) => {
            const s = data?.summary[tool.id];
            return (
              <KpiCard
                key={tool.id}
                title={tool.label}
                value={s?.accountsScraped.toLocaleString() ?? "0"}
                changeLabel="accounts scraped"
              />
            );
          })
        )}
      </div>

      {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tool Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer height={280}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Bar dataKey="scraped" name="Scraped" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="worked" name="Worked" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="contacts" name="Contacts" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Usage History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : (
            <DataTable columns={columns} data={data?.entries ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

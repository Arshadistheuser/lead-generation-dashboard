"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { KpiCard } from "@/components/shared/kpi-card";
import { KpiCardSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/shared/chart-container";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";

interface ReportData {
  period: string;
  dateFrom: string;
  dateTo: string;
  current: {
    accountsResearched: number;
    accountsAdded: number;
    contactsAdded: number;
    contactPhoneYes: number;
    contactPhoneNo: number;
    meetingsSet: number;
    totalEntries: number;
  };
  changes: Record<string, number>;
  memberBreakdown: Array<{
    id: string;
    name: string;
    accountsResearched: number;
    accountsAdded: number;
    contactsAdded: number;
    contactPhoneYes: number;
    meetingsSet: number;
    totalEntries: number;
  }>;
}

const memberColumns: ColumnDef<ReportData["memberBreakdown"][number]>[] = [
  { accessorKey: "name", header: "Team Member" },
  {
    accessorKey: "accountsResearched",
    header: "Researched",
    cell: ({ row }) => <span className="font-mono">{row.getValue("accountsResearched")}</span>,
  },
  {
    accessorKey: "accountsAdded",
    header: "Added",
    cell: ({ row }) => <span className="font-mono">{row.getValue("accountsAdded")}</span>,
  },
  {
    accessorKey: "contactsAdded",
    header: "Contacts",
    cell: ({ row }) => <span className="font-mono">{row.getValue("contactsAdded")}</span>,
  },
  {
    accessorKey: "contactPhoneYes",
    header: "Phone #",
    cell: ({ row }) => <span className="font-mono">{row.getValue("contactPhoneYes")}</span>,
  },
  {
    accessorKey: "meetingsSet",
    header: "Meetings",
    cell: ({ row }) => <span className="font-mono">{row.getValue("meetingsSet")}</span>,
  },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState("weekly");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["reports", period, date],
    queryFn: () =>
      fetch(`/api/reports?period=${period}&date=${date}`).then((r) => r.json()),
  });

  const handleExport = () => {
    window.open(`/api/export?type=${period}&date=${date}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              title="Accounts Researched"
              value={report?.current.accountsResearched.toLocaleString() ?? "0"}
              change={report?.changes.accountsResearched}
              changeLabel={`vs prev ${period === "weekly" ? "week" : "month"}`}
            />
            <KpiCard
              title="Accounts Added"
              value={report?.current.accountsAdded.toLocaleString() ?? "0"}
              change={report?.changes.accountsAdded}
              changeLabel={`vs prev ${period === "weekly" ? "week" : "month"}`}
            />
            <KpiCard
              title="Contacts Added"
              value={report?.current.contactsAdded.toLocaleString() ?? "0"}
              change={report?.changes.contactsAdded}
              changeLabel={`vs prev ${period === "weekly" ? "week" : "month"}`}
            />
            <KpiCard
              title="Meetings Set"
              value={report?.current.meetingsSet.toLocaleString() ?? "0"}
              change={report?.changes.meetingsSet}
              changeLabel={`vs prev ${period === "weekly" ? "week" : "month"}`}
            />
          </>
        )}
      </div>

      {/* Chart + Table */}
      {!isLoading && report && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Member Comparison — Contacts Added
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer height={300}>
                <BarChart
                  data={report.memberBreakdown.sort(
                    (a, b) => b.contactsAdded - a.contactsAdded
                  )}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
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
                    dataKey="contactsAdded"
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Member Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={memberColumns} data={report.memberBreakdown} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

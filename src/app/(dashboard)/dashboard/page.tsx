"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/shared/kpi-card";
import { KpiCardSkeleton, ChartSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/shared/chart-container";
import { AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { Users, Target, Phone, CalendarCheck } from "lucide-react";
import { format } from "date-fns";

interface ReportData {
  current: {
    accountsResearched: number;
    accountsAdded: number;
    contactsAdded: number;
    contactPhoneYes: number;
    meetingsSet: number;
  };
  changes: {
    accountsResearched: number;
    accountsAdded: number;
    contactsAdded: number;
    meetingsSet: number;
  };
  memberBreakdown: Array<{
    id: string;
    name: string;
    contactsAdded: number;
    accountsAdded: number;
    meetingsSet: number;
  }>;
}

interface DailyEntry {
  id: string;
  date: string;
  accountsResearched: number;
  accountsAdded: number;
  contactsAdded: number;
  meetingsSet: number;
  teamMember: { name: string };
}

export default function DashboardPage() {
  const { data: report, isLoading: reportLoading } = useQuery<ReportData>({
    queryKey: ["reports", "weekly"],
    queryFn: () => fetch("/api/reports?period=weekly").then((r) => r.json()),
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<DailyEntry[]>({
    queryKey: ["daily-entries-recent"],
    queryFn: () => {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      return fetch(`/api/daily-entries?dateFrom=${from.toISOString().split("T")[0]}`).then((r) => r.json());
    },
  });

  // Aggregate entries by date for chart
  const dailyTrend = entries
    ? Object.values(
        entries.reduce<Record<string, { date: string; contacts: number; accounts: number; meetings: number }>>(
          (acc, entry) => {
            const date = entry.date.split("T")[0];
            if (!acc[date]) acc[date] = { date, contacts: 0, accounts: 0, meetings: 0 };
            acc[date].contacts += entry.contactsAdded;
            acc[date].accounts += entry.accountsAdded;
            acc[date].meetings += entry.meetingsSet;
            return acc;
          },
          {}
        )
      ).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              title="Accounts Researched"
              value={report?.current.accountsResearched.toLocaleString() ?? "0"}
              change={report?.changes.accountsResearched}
              changeLabel="vs last week"
              icon={<Target className="h-4 w-4" />}
            />
            <KpiCard
              title="Contacts Added"
              value={report?.current.contactsAdded.toLocaleString() ?? "0"}
              change={report?.changes.contactsAdded}
              changeLabel="vs last week"
              icon={<Users className="h-4 w-4" />}
            />
            <KpiCard
              title="Phone Numbers"
              value={report?.current.contactPhoneYes.toLocaleString() ?? "0"}
              icon={<Phone className="h-4 w-4" />}
            />
            <KpiCard
              title="Meetings Set"
              value={report?.current.meetingsSet.toLocaleString() ?? "0"}
              change={report?.changes.meetingsSet}
              changeLabel="vs last week"
              icon={<CalendarCheck className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {entriesLoading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Daily Activity Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer height={280}>
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="colorContacts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(new Date(d), "MMM dd")}
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="contacts"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#colorContacts)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Team Performance (This Week)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer height={280}>
                  <BarChart
                    data={report?.memberBreakdown
                      .sort((a, b) => b.contactsAdded - a.contactsAdded)
                      .slice(0, 10) ?? []}
                    layout="vertical"
                  >
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      dataKey="name"
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
                    <Bar dataKey="contactsAdded" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

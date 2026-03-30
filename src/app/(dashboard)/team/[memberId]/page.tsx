"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { ChartContainer } from "@/components/shared/chart-container";
import { DataTable } from "@/components/shared/data-table";
import { KpiCardSkeleton } from "@/components/shared/loading-skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Users, Target, Phone, CalendarCheck } from "lucide-react";

interface DailyEntry {
  id: string;
  date: string;
  accountsResearched: number;
  accountsAdded: number;
  contactsAdded: number;
  contactPhoneYes: number;
  meetingsSet: number;
  source: string | null;
  industry: string | null;
  onLeave: boolean;
  teamMember: { name: string };
}

const columns: ColumnDef<DailyEntry>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {format(new Date(row.getValue("date")), "MMM dd")}
      </span>
    ),
  },
  {
    accessorKey: "accountsResearched",
    header: "Researched",
    cell: ({ row }) => <span className="font-mono">{row.getValue("accountsResearched")}</span>,
  },
  {
    accessorKey: "contactsAdded",
    header: "Contacts",
    cell: ({ row }) => <span className="font-mono">{row.getValue("contactsAdded")}</span>,
  },
  {
    accessorKey: "meetingsSet",
    header: "Meetings",
    cell: ({ row }) => <span className="font-mono">{row.getValue("meetingsSet")}</span>,
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => row.original.source || "-",
  },
  {
    accessorKey: "industry",
    header: "Industry",
    cell: ({ row }) => row.original.industry || "-",
  },
];

export default function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>();

  const { data: entries, isLoading } = useQuery<DailyEntry[]>({
    queryKey: ["member-entries", memberId],
    queryFn: () => {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return fetch(
        `/api/daily-entries?memberId=${memberId}&dateFrom=${from.toISOString().split("T")[0]}`
      ).then((r) => r.json());
    },
  });

  const activeEntries = entries?.filter((e) => !e.onLeave) ?? [];
  const memberName = entries?.[0]?.teamMember?.name ?? "Team Member";

  const totals = {
    accountsResearched: activeEntries.reduce((s, e) => s + e.accountsResearched, 0),
    contactsAdded: activeEntries.reduce((s, e) => s + e.contactsAdded, 0),
    phoneNumbers: activeEntries.reduce((s, e) => s + e.contactPhoneYes, 0),
    meetings: activeEntries.reduce((s, e) => s + e.meetingsSet, 0),
  };

  const chartData = activeEntries
    .map((e) => ({
      date: e.date.split("T")[0],
      contacts: e.contactsAdded,
      accounts: e.accountsResearched,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">{memberName} — Last 30 Days</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard title="Accounts Researched" value={totals.accountsResearched} icon={<Target className="h-4 w-4" />} />
            <KpiCard title="Contacts Added" value={totals.contactsAdded} icon={<Users className="h-4 w-4" />} />
            <KpiCard title="Phone Numbers" value={totals.phoneNumbers} icon={<Phone className="h-4 w-4" />} />
            <KpiCard title="Meetings Set" value={totals.meetings} icon={<CalendarCheck className="h-4 w-4" />} />
          </>
        )}
      </div>

      {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Contacts Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer height={250}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(new Date(d), "MMM dd")}
                  tick={{ fontSize: 11 }}
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
                <Line type="monotone" dataKey="contacts" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={entries ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

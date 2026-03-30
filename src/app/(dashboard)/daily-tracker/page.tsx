"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { INDUSTRIES } from "@/lib/constants";

interface DailyEntry {
  id: string;
  date: string;
  teamMemberId: string;
  teamMember: { name: string };
  accountsResearched: number;
  accountsAdded: number;
  contactsAdded: number;
  contactPhoneYes: number;
  contactPhoneNo: number;
  meetingsSet: number;
  source: string | null;
  industry: string | null;
  techStack: string | null;
  onLeave: boolean;
}

const columns: ColumnDef<DailyEntry>[] = [
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
    header: "Team Member",
    cell: ({ row }) => row.original.teamMember.name,
  },
  {
    accessorKey: "onLeave",
    header: "Status",
    cell: ({ row }) =>
      row.original.onLeave ? (
        <Badge variant="secondary">On Leave</Badge>
      ) : (
        <Badge variant="default">Active</Badge>
      ),
  },
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

export default function DailyTrackerPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [industry, setIndustry] = useState<string>("all");

  const { data: entries, isLoading } = useQuery<DailyEntry[]>({
    queryKey: ["daily-entries", dateFrom, dateTo, industry],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (industry && industry !== "all") params.set("industry", industry);
      return fetch(`/api/daily-entries?${params}`).then((r) => r.json());
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
          <Select value={industry} onValueChange={(v) => setIndustry(v ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Industries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Link href="/daily-tracker/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Entry
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} />
      ) : (
        <DataTable columns={columns} data={entries ?? []} />
      )}
    </div>
  );
}

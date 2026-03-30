"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Trophy } from "lucide-react";

interface MemberStats {
  id: string;
  name: string;
  totalAccountsResearched: number;
  totalAccountsAdded: number;
  totalContactsAdded: number;
  totalMeetingsSet: number;
  totalPhoneNumbers: number;
  daysWorked: number;
  avgContactsPerDay: number;
}

const columns: ColumnDef<MemberStats>[] = [
  {
    id: "rank",
    header: "#",
    cell: ({ row }) => {
      const rank = row.index + 1;
      if (rank <= 3) {
        return (
          <Badge variant={rank === 1 ? "default" : "secondary"} className="w-6 h-6 flex items-center justify-center p-0">
            {rank}
          </Badge>
        );
      }
      return <span className="text-muted-foreground font-mono text-sm">{rank}</span>;
    },
  },
  {
    accessorKey: "name",
    header: "Team Member",
    cell: ({ row }) => (
      <Link
        href={`/team/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "totalContactsAdded",
    header: "Contacts",
    cell: ({ row }) => <span className="font-mono">{row.getValue("totalContactsAdded")}</span>,
  },
  {
    accessorKey: "totalAccountsResearched",
    header: "Researched",
    cell: ({ row }) => <span className="font-mono">{row.getValue("totalAccountsResearched")}</span>,
  },
  {
    accessorKey: "totalAccountsAdded",
    header: "Added",
    cell: ({ row }) => <span className="font-mono">{row.getValue("totalAccountsAdded")}</span>,
  },
  {
    accessorKey: "totalPhoneNumbers",
    header: "Phone #",
    cell: ({ row }) => <span className="font-mono">{row.getValue("totalPhoneNumbers")}</span>,
  },
  {
    accessorKey: "totalMeetingsSet",
    header: "Meetings",
    cell: ({ row }) => <span className="font-mono">{row.getValue("totalMeetingsSet")}</span>,
  },
  {
    accessorKey: "daysWorked",
    header: "Days",
    cell: ({ row }) => <span className="font-mono">{row.getValue("daysWorked")}</span>,
  },
  {
    accessorKey: "avgContactsPerDay",
    header: "Avg/Day",
    cell: ({ row }) => <span className="font-mono">{row.getValue("avgContactsPerDay")}</span>,
  },
];

export default function TeamPage() {
  const { data, isLoading } = useQuery<{ leaderboard: MemberStats[] }>({
    queryKey: ["team", 30],
    queryFn: () => fetch("/api/team?days=30").then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      {/* Top 3 Cards */}
      {!isLoading && data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.leaderboard.slice(0, 3).map((member, i) => (
            <Card key={member.id} className={i === 0 ? "border-primary" : ""}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    {i === 0 ? (
                      <Trophy className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        #{i + 1}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono">{member.totalContactsAdded}</span> contacts
                      {" · "}
                      <span className="font-mono">{member.totalMeetingsSet}</span> meetings
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Team Leaderboard (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} />
          ) : (
            <DataTable columns={columns} data={data?.leaderboard ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

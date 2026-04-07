"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Globe,
  RefreshCw,
  Database,
} from "lucide-react";

interface MatchResult {
  name: string;
  domain: string;
  industry: string;
  revenue: string;
  employees: string;
  location: string;
  status: "found" | "not_found" | "possible_match";
  matchConfidence?: number;
  hubspotId?: string;
  hubspotName?: string;
  hubspotDomain?: string;
}

interface Summary {
  total: number;
  found: number;
  notFound: number;
  possibleMatch: number;
}

const statusIcon = {
  found: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  not_found: <XCircle className="h-4 w-4 text-red-500" />,
  possible_match: <AlertCircle className="h-4 w-4 text-yellow-500" />,
};

const statusLabel = {
  found: "In HubSpot",
  not_found: "Not Found",
  possible_match: "Possible Match",
};

const columns: ColumnDef<MatchResult>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {statusIcon[row.original.status]}
        <Badge
          variant={
            row.original.status === "found"
              ? "default"
              : row.original.status === "not_found"
              ? "destructive"
              : "secondary"
          }
        >
          {statusLabel[row.original.status]}
        </Badge>
      </div>
    ),
  },
  { accessorKey: "name", header: "Company Name" },
  {
    accessorKey: "domain",
    header: "Website / Domain",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.original.domain ? (
          <a
            href={`https://${row.original.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {row.original.domain}
          </a>
        ) : (
          "—"
        )}
      </span>
    ),
  },
  { accessorKey: "industry", header: "Industry" },
  { accessorKey: "revenue", header: "Revenue" },
  { accessorKey: "employees", header: "Employees" },
  { accessorKey: "location", header: "Location" },
  {
    accessorKey: "matchConfidence",
    header: "Confidence",
    cell: ({ row }) => {
      const c = row.original.matchConfidence;
      if (!c) return "—";
      return (
        <span
          className={`font-mono text-sm ${
            c >= 90 ? "text-emerald-500" : c >= 65 ? "text-yellow-500" : "text-muted-foreground"
          }`}
        >
          {c}%
        </span>
      );
    },
  },
  {
    accessorKey: "hubspotName",
    header: "HubSpot Match",
    cell: ({ row }) =>
      row.original.hubspotName ? (
        <span className="text-sm text-muted-foreground">
          {row.original.hubspotName}
          {row.original.hubspotId && (
            <a
              href={`https://app.hubspot.com/contacts/7991245/company/${row.original.hubspotId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-500 hover:underline"
            >
              View
            </a>
          )}
        </span>
      ) : (
        "—"
      ),
  },
];

interface CacheStatus {
  cached: boolean;
  totalCached: number;
  syncing: boolean;
  lastSyncAt: string | null;
}

export default function CompanyMatcherPage() {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "found" | "not_found" | "possible_match">("all");
  const [file, setFile] = useState<File | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Auto-load latest results + cache status on page load
  useEffect(() => {
    loadLatestResults();
    loadCacheStatus();
  }, []);

  // Poll cache status while syncing
  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(loadCacheStatus, 5000);
    return () => clearInterval(interval);
  }, [syncing]);

  async function loadCacheStatus() {
    try {
      const res = await fetch("/api/hubspot-cache/status");
      const data: CacheStatus = await res.json();
      setCacheStatus(data);
      if (data.syncing) {
        setSyncing(true);
      } else if (syncing && data.totalCached > 0) {
        setSyncing(false);
      }
    } catch { /* ignore */ }
  }

  async function handleSync() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/hubspot-cache/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      await loadCacheStatus();
      setSyncing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setSyncing(false);
    }
  }

  async function loadLatestResults() {
    try {
      const res = await fetch("/api/company-matcher/extension");
      const data = await res.json();
      if (data.session && data.session.results?.length > 0) {
        setResults(data.session.results);
        setSummary(data.session.summary);
        setLastLoadedAt(data.session.createdAt);
      }
    } catch {
      // No results yet — that's fine
    }
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/company-matcher/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Matching failed");

      setResults(data.results || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Matching failed");
    } finally {
      setLoading(false);
    }
  }

  function handleExport(statusFilter?: string) {
    const data = statusFilter
      ? results.filter((r) => r.status === statusFilter)
      : results;

    const headers = ["Status", "Company Name", "Domain", "Industry", "Revenue", "Employees", "Location", "Confidence", "HubSpot Match", "HubSpot ID"];
    const csvRows = [
      headers.join(","),
      ...data.map((r) =>
        [
          statusLabel[r.status],
          `"${(r.name || "").replace(/"/g, '""')}"`,
          r.domain,
          `"${(r.industry || "").replace(/"/g, '""')}"`,
          `"${(r.revenue || "").replace(/"/g, '""')}"`,
          r.employees,
          `"${(r.location || "").replace(/"/g, '""')}"`,
          r.matchConfidence || "",
          `"${(r.hubspotName || "").replace(/"/g, '""')}"`,
          r.hubspotId || "",
        ].join(",")
      ),
    ];
    const csv = csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `company-match-${statusFilter || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredResults =
    filter === "all" ? results : results.filter((r) => r.status === filter);

  return (
    <div className="space-y-6">
      {/* HubSpot Cache Status */}
      <Card className={cacheStatus?.cached ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className={`h-5 w-5 ${cacheStatus?.cached ? "text-emerald-600" : "text-amber-600"}`} />
            <div>
              {cacheStatus?.cached ? (
                <>
                  <p className="text-sm font-medium text-emerald-800">
                    HubSpot Cache: {cacheStatus.totalCached.toLocaleString()} companies loaded
                  </p>
                  <p className="text-xs text-emerald-600">
                    Last synced: {cacheStatus.lastSyncAt ? new Date(cacheStatus.lastSyncAt).toLocaleString() : "Never"}
                    {" — "}Matching is instant
                  </p>
                </>
              ) : syncing ? (
                <>
                  <p className="text-sm font-medium text-amber-800">
                    Syncing HubSpot companies...
                  </p>
                  <p className="text-xs text-amber-600">
                    This takes 2-5 minutes the first time. You only need to do this once.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-amber-800">
                    HubSpot cache is empty
                  </p>
                  <p className="text-xs text-amber-600">
                    Click &quot;Sync HubSpot&quot; to load your CRM companies. This is a one-time setup.
                  </p>
                </>
              )}
            </div>
          </div>
          <Button
            onClick={handleSync}
            disabled={syncing}
            size="sm"
            variant={cacheStatus?.cached ? "outline" : "default"}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {syncing ? "Syncing..." : cacheStatus?.cached ? "Re-sync" : "Sync HubSpot"}
          </Button>
        </CardContent>
      </Card>

      {/* How to Use + Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Extension Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" /> Capture from ZoomInfo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-4 space-y-1">
              <li>Install the Globe extension from <code className="font-mono text-xs bg-muted px-1 rounded">chrome://extensions</code></li>
              <li>Go to ZoomInfo and log in (handle OTP yourself)</li>
              <li>Apply your filters — the LeadGen widget appears on the page</li>
              <li>Click <strong>&quot;Capture This Page&quot;</strong> on each page of results</li>
              <li>Click <strong>&quot;Match with HubSpot&quot;</strong> to check against your CRM</li>
              <li>Results appear here automatically</li>
            </ol>
          </CardContent>
        </Card>

        {/* Upload Excel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" /> Upload Company List
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Or upload an Excel/CSV with &quot;Company Name&quot; and &quot;Website&quot; columns.
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="flex-1"
              />
              <Button onClick={handleUpload} disabled={!file || loading} size="sm">
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                {loading ? "Matching..." : "Match"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card
            className={`cursor-pointer transition-all ${filter === "all" ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-muted"}`}
            onClick={() => setFilter("all")}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono">{summary.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${filter === "found" ? "ring-2 ring-emerald-500" : "hover:ring-1 hover:ring-muted"}`}
            onClick={() => setFilter("found")}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono text-emerald-500">{summary.found}</p>
              <p className="text-sm text-muted-foreground">In HubSpot</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${filter === "not_found" ? "ring-2 ring-red-500" : "hover:ring-1 hover:ring-muted"}`}
            onClick={() => setFilter("not_found")}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono text-red-500">{summary.notFound}</p>
              <p className="text-sm text-muted-foreground">Not in HubSpot</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${filter === "possible_match" ? "ring-2 ring-yellow-500" : "hover:ring-1 hover:ring-muted"}`}
            onClick={() => setFilter("possible_match")}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono text-yellow-500">{summary.possibleMatch}</p>
              <p className="text-sm text-muted-foreground">Possible Match</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">
                Match Results ({filteredResults.length})
              </CardTitle>
              {lastLoadedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last matched: {new Date(lastLoadedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadLatestResults}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport()}>
                <Download className="h-4 w-4 mr-1" /> Export All
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("not_found")}>
                <Download className="h-4 w-4 mr-1" /> Export New Only
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={filteredResults} pageSize={25} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground space-y-2">
              <Globe className="h-10 w-10 mx-auto opacity-30" />
              <p className="text-lg font-medium">No match results yet</p>
              <p className="text-sm">
                Use the Globe extension on ZoomInfo to capture companies, then click
                &quot;Match with HubSpot&quot;. Results will appear here.
              </p>
              <p className="text-sm">
                Or upload an Excel/CSV file above to match companies directly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

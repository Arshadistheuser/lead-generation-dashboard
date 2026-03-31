"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  Search,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";

interface MatchResult {
  name: string;
  domain: string;
  industry: string;
  revenue: string;
  employees: string;
  location: string;
  status: "found" | "not_found" | "possible_match";
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
    header: "Domain",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.domain || "—"}</span>
    ),
  },
  { accessorKey: "industry", header: "Industry" },
  { accessorKey: "revenue", header: "Revenue" },
  { accessorKey: "employees", header: "Employees" },
  { accessorKey: "location", header: "Location" },
  {
    accessorKey: "hubspotName",
    header: "HubSpot Match",
    cell: ({ row }) =>
      row.original.hubspotName ? (
        <span className="text-sm text-muted-foreground">
          {row.original.hubspotName}
          {row.original.hubspotId && (
            <a
              href={`https://app.hubspot.com/contacts/companies/${row.original.hubspotId}`}
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

export default function CompanyMatcherPage() {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "found" | "not_found" | "possible_match">("all");

  // ZoomInfo form state
  const [ziEmail, setZiEmail] = useState("");
  const [ziPassword, setZiPassword] = useState("");
  const [ziIndustry, setZiIndustry] = useState("");
  const [ziRevenueMin, setZiRevenueMin] = useState("");
  const [ziRevenueMax, setZiRevenueMax] = useState("");
  const [ziCountry, setZiCountry] = useState("");
  const [ziTechStack, setZiTechStack] = useState("");
  const [ziMaxResults, setZiMaxResults] = useState("100");

  // Upload state
  const [file, setFile] = useState<File | null>(null);

  async function handleScrape() {
    setLoading(true);
    setError("");
    setResults([]);
    setSummary(null);
    setLogs(["Starting ZoomInfo scrape..."]);

    try {
      const res = await fetch("/api/company-matcher/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ziEmail,
          password: ziPassword,
          maxResults: parseInt(ziMaxResults) || 100,
          filters: {
            industry: ziIndustry ? ziIndustry.split(",").map((s) => s.trim()) : undefined,
            revenueMin: ziRevenueMin || undefined,
            revenueMax: ziRevenueMax || undefined,
            country: ziCountry ? ziCountry.split(",").map((s) => s.trim()) : undefined,
            techStack: ziTechStack ? ziTechStack.split(",").map((s) => s.trim()) : undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scraping failed");

      setResults(data.results || []);
      setSummary(data.summary || null);
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scraping failed");
    } finally {
      setLoading(false);
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

    const ws = XLSX.utils.json_to_sheet(
      data.map((r) => ({
        Status: statusLabel[r.status],
        "Company Name": r.name,
        Domain: r.domain,
        Industry: r.industry,
        Revenue: r.revenue,
        Employees: r.employees,
        Location: r.location,
        "HubSpot Match": r.hubspotName || "",
        "HubSpot ID": r.hubspotId || "",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `company-match-${statusFilter || "all"}.xlsx`);
  }

  const filteredResults =
    filter === "all" ? results : results.filter((r) => r.status === filter);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="scrape">
        <TabsList>
          <TabsTrigger value="scrape">
            <Search className="h-4 w-4 mr-1" /> ZoomInfo Scrape
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-1" /> Upload Excel
          </TabsTrigger>
        </TabsList>

        {/* ZoomInfo Scrape Tab */}
        <TabsContent value="scrape">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Scrape ZoomInfo & Match with HubSpot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ZoomInfo Email</Label>
                  <Input
                    type="email"
                    value={ziEmail}
                    onChange={(e) => setZiEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ZoomInfo Password</Label>
                  <Input
                    type="password"
                    value={ziPassword}
                    onChange={(e) => setZiPassword(e.target.value)}
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Industries (comma separated)</Label>
                  <Input
                    value={ziIndustry}
                    onChange={(e) => setZiIndustry(e.target.value)}
                    placeholder="Manufacturing, Retail, Healthcare"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Technology / Tech Stack (comma separated)</Label>
                  <Input
                    value={ziTechStack}
                    onChange={(e) => setZiTechStack(e.target.value)}
                    placeholder="SAP, Oracle, Microsoft Dynamics"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Revenue Min ($M)</Label>
                  <Input
                    value={ziRevenueMin}
                    onChange={(e) => setZiRevenueMin(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Revenue Max ($M)</Label>
                  <Input
                    value={ziRevenueMax}
                    onChange={(e) => setZiRevenueMax(e.target.value)}
                    placeholder="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Countries (comma separated)</Label>
                  <Input
                    value={ziCountry}
                    onChange={(e) => setZiCountry(e.target.value)}
                    placeholder="United States, India"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Results</Label>
                  <Input
                    type="number"
                    value={ziMaxResults}
                    onChange={(e) => setZiMaxResults(e.target.value)}
                    placeholder="100"
                  />
                </div>
              </div>

              <Button
                onClick={handleScrape}
                disabled={loading || !ziEmail || !ziPassword}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scraping & Matching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Scrape ZoomInfo & Match HubSpot
                  </>
                )}
              </Button>

              {/* Logs */}
              {logs.length > 0 && (
                <div className="bg-muted rounded-md p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Progress Log
                  </p>
                  {logs.map((log, i) => (
                    <p key={i} className="text-xs font-mono text-muted-foreground">
                      {log}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Excel Tab */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Upload Company List & Match with HubSpot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload an Excel or CSV file with company data. The file should have columns
                like &ldquo;Company Name&rdquo;, &ldquo;Website&rdquo; or &ldquo;Domain&rdquo;.
                We&apos;ll check each company against HubSpot by domain.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="flex-1"
                />
                <Button onClick={handleUpload} disabled={!file || loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  {loading ? "Matching..." : "Upload & Match"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            className={`cursor-pointer ${filter === "all" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilter("all")}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono">{summary.total}</p>
              <p className="text-sm text-muted-foreground">Total Companies</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer ${filter === "found" ? "ring-2 ring-emerald-500" : ""}`}
            onClick={() => setFilter("found")}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono text-emerald-500">
                {summary.found}
              </p>
              <p className="text-sm text-muted-foreground">In HubSpot</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer ${filter === "not_found" ? "ring-2 ring-red-500" : ""}`}
            onClick={() => setFilter("not_found")}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono text-red-500">
                {summary.notFound}
              </p>
              <p className="text-sm text-muted-foreground">Not in HubSpot</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer ${filter === "possible_match" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setFilter("possible_match")}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold font-mono text-yellow-500">
                {summary.possibleMatch}
              </p>
              <p className="text-sm text-muted-foreground">Possible Match</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Results ({filteredResults.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport()}>
                <Download className="h-4 w-4 mr-1" /> Export All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("not_found")}
              >
                <Download className="h-4 w-4 mr-1" /> Export New Only
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={filteredResults} pageSize={25} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

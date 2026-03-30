"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, RefreshCw, Users, Building2, Handshake } from "lucide-react";
import { useState } from "react";

export default function HubSpotPage() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/hubspot/sync", { method: "POST" });
      if (res.ok) {
        setLastSync(new Date().toLocaleString());
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sync Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">HubSpot Sync Status</p>
                <p className="text-sm text-muted-foreground">
                  {lastSync ? `Last synced: ${lastSync}` : "No sync data available yet"}
                </p>
              </div>
              <Badge variant={lastSync ? "default" : "secondary"}>
                {lastSync ? "Connected" : "Not Configured"}
              </Badge>
            </div>
            <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* HubSpot KPIs - placeholder until sync is configured */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Contacts" value="—" icon={<Users className="h-4 w-4" />} />
        <KpiCard title="Total Companies" value="—" icon={<Building2 className="h-4 w-4" />} />
        <KpiCard title="Total Deals" value="—" icon={<Handshake className="h-4 w-4" />} />
      </div>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>To enable HubSpot integration:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Go to your HubSpot account &rarr; Settings &rarr; Integrations &rarr; Private Apps
            </li>
            <li>
              Create a new private app with scopes:{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                crm.objects.contacts.read, crm.objects.companies.read, crm.objects.deals.read
              </code>
            </li>
            <li>
              Copy the access token and add it to your{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.env</code>{" "}
              file as <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">HUBSPOT_ACCESS_TOKEN</code>
            </li>
            <li>Restart the dev server and click &ldquo;Sync Now&rdquo;</li>
          </ol>
          <p className="mt-4">
            Once configured, daily snapshots will be collected automatically via cron job at 2 AM UTC.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

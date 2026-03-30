"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TEAM_MEMBERS, INDUSTRIES, TOOLS } from "@/lib/constants";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Default Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Admin</span>
            <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
              admin@leadgen.com / admin123
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Viewer</span>
            <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
              viewer@leadgen.com / viewer123
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Team Members ({TEAM_MEMBERS.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TEAM_MEMBERS.map((name) => (
              <Badge key={name} variant="secondary">{name}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tracked Industries ({INDUSTRIES.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map((ind) => (
              <Badge key={ind} variant="outline">{ind}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Data Sources & Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TOOLS.map((tool) => (
              <Badge key={tool.id} variant="outline">{tool.label}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, imported: 0, skipped: 0, errors: ["Upload failed"] });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Import Excel Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload the Lead Generation Data Tracker Excel file to import daily entries.
            The importer reads the &ldquo;Daily Tracker&rdquo; sheet and maps data to team members.
          </p>

          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="flex-1"
            />
            <Button onClick={handleUpload} disabled={!file || uploading}>
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "Importing..." : "Import"}
            </Button>
          </div>

          {result && (
            <div className={`rounded-md p-4 ${result.success ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="font-medium text-sm">
                  {result.success ? "Import Complete" : "Import Failed"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{result.imported}</span> entries imported,{" "}
                <span className="font-mono">{result.skipped}</span> skipped
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-xs text-destructive">{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Expected Format</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>The Excel file should have a &ldquo;Daily Tracker&rdquo; sheet with columns:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Date</li>
            <li>Lead Gen Name (team member name)</li>
            <li>Accounts Researched / Accounts Added</li>
            <li>Contacts Added / Contact Number (Yes/No)</li>
            <li>Meetings Set</li>
            <li>Source / Tech Stack</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

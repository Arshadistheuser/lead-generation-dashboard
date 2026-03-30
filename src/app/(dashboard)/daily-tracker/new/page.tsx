"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { INDUSTRIES, DATA_SOURCES, TECH_STACKS } from "@/lib/constants";

export default function NewEntryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data: members } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["team-members"],
    queryFn: () => fetch("/api/team-members").then((r) => r.json()),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body = {
      date: formData.get("date"),
      teamMemberId: formData.get("teamMemberId"),
      accountsResearched: Number(formData.get("accountsResearched")) || 0,
      accountsAdded: Number(formData.get("accountsAdded")) || 0,
      contactsAdded: Number(formData.get("contactsAdded")) || 0,
      contactPhoneYes: Number(formData.get("contactPhoneYes")) || 0,
      contactPhoneNo: Number(formData.get("contactPhoneNo")) || 0,
      meetingsSet: Number(formData.get("meetingsSet")) || 0,
      source: formData.get("source") || null,
      industry: formData.get("industry") || null,
      techStack: formData.get("techStack") || null,
      notes: formData.get("notes") || null,
      onLeave: formData.get("onLeave") === "on",
    };

    try {
      const res = await fetch("/api/daily-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.push("/daily-tracker");
    } catch {
      setError("Failed to save entry. It may already exist for this date and member.");
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>New Daily Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamMemberId">Team Member</Label>
              <Select name="teamMemberId" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {members?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="onLeave" name="onLeave" />
            <Label htmlFor="onLeave">On Leave</Label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountsResearched">Accounts Researched</Label>
              <Input id="accountsResearched" name="accountsResearched" type="number" min="0" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountsAdded">Accounts Added</Label>
              <Input id="accountsAdded" name="accountsAdded" type="number" min="0" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactsAdded">Contacts Added</Label>
              <Input id="contactsAdded" name="contactsAdded" type="number" min="0" defaultValue="0" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhoneYes">Phone # (Yes)</Label>
              <Input id="contactPhoneYes" name="contactPhoneYes" type="number" min="0" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhoneNo">Phone # (No)</Label>
              <Input id="contactPhoneNo" name="contactPhoneNo" type="number" min="0" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meetingsSet">Meetings Set</Label>
              <Input id="meetingsSet" name="meetingsSet" type="number" min="0" defaultValue="0" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source">Data Source</Label>
              <Select name="source">
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select name="industry">
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="techStack">Tech Stack</Label>
              <Select name="techStack">
                <SelectTrigger>
                  <SelectValue placeholder="Select stack" />
                </SelectTrigger>
                <SelectContent>
                  {TECH_STACKS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Optional notes..." />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

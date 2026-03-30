"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard Overview",
  "/daily-tracker": "Daily Tracker",
  "/daily-tracker/new": "New Entry",
  "/reports": "Reports",
  "/team": "Team Performance",
  "/hubspot": "HubSpot Integration",
  "/industries": "Industry Breakdown",
  "/tools": "Tool Tracker",
  "/import": "Import Data",
  "/settings": "Settings",
};

export function Topbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const title =
    pageTitles[pathname] ||
    Object.entries(pageTitles).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ||
    "Dashboard";

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  );
}

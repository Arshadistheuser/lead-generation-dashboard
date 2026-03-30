-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hubspotOwnerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "accountsResearched" INTEGER NOT NULL DEFAULT 0,
    "accountsAdded" INTEGER NOT NULL DEFAULT 0,
    "contactsAdded" INTEGER NOT NULL DEFAULT 0,
    "contactPhoneYes" INTEGER NOT NULL DEFAULT 0,
    "contactPhoneNo" INTEGER NOT NULL DEFAULT 0,
    "meetingsSet" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "industry" TEXT,
    "techStack" TEXT,
    "notes" TEXT,
    "onLeave" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyEntry_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HubSpotSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "teamMemberId" TEXT,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "newContactsToday" INTEGER NOT NULL DEFAULT 0,
    "totalCompanies" INTEGER NOT NULL DEFAULT 0,
    "newCompaniesToday" INTEGER NOT NULL DEFAULT 0,
    "totalDeals" INTEGER NOT NULL DEFAULT 0,
    "newDealsToday" INTEGER NOT NULL DEFAULT 0,
    "industryBreakdown" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubSpotSnapshot_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "accountsScraped" INTEGER NOT NULL DEFAULT 0,
    "accountsWorked" INTEGER NOT NULL DEFAULT 0,
    "contactsAdded" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToolUsage_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_name_key" ON "TeamMember"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_hubspotOwnerId_key" ON "TeamMember"("hubspotOwnerId");

-- CreateIndex
CREATE INDEX "DailyEntry_date_idx" ON "DailyEntry"("date");

-- CreateIndex
CREATE INDEX "DailyEntry_teamMemberId_idx" ON "DailyEntry"("teamMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEntry_date_teamMemberId_key" ON "DailyEntry"("date", "teamMemberId");

-- CreateIndex
CREATE INDEX "HubSpotSnapshot_date_idx" ON "HubSpotSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "HubSpotSnapshot_date_teamMemberId_key" ON "HubSpotSnapshot"("date", "teamMemberId");

-- CreateIndex
CREATE INDEX "ToolUsage_date_idx" ON "ToolUsage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ToolUsage_date_teamMemberId_tool_key" ON "ToolUsage"("date", "teamMemberId", "tool");

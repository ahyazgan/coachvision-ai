-- CreateTable
CREATE TABLE "MatchPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Varsayılan plan',
    "formation" TEXT NOT NULL,
    "teamInstructions" JSONB NOT NULL,
    "playerAssignments" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchPlan_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlan_matchId_key" ON "MatchPlan"("matchId");

-- CreateIndex
CREATE INDEX "MatchPlan_matchId_idx" ON "MatchPlan"("matchId");

-- CreateTable
CREATE TABLE "ValidationSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "frameTimeSec" REAL NOT NULL,
    "groundTruth" JSONB NOT NULL,
    "systemOutput" JSONB NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationSample_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "MatchVideo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ValidationSample_videoId_idx" ON "ValidationSample"("videoId");

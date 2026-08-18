-- CreateTable
CREATE TABLE "Nudge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "remindAt" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'manual',
    "category" TEXT NOT NULL DEFAULT 'custom',
    "entityType" TEXT,
    "entityId" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Nudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "widgetLayout" TEXT,
    "syncMode" TEXT NOT NULL DEFAULT 'manual',
    "syncIntervalMins" INTEGER NOT NULL DEFAULT 30,
    "notificationPrefs" TEXT,
    "targetGrades" TEXT,
    "lastSeenFeedAt" DATETIME,
    "accent" TEXT NOT NULL DEFAULT 'indigo',
    "background" TEXT NOT NULL DEFAULT 'plain',
    "backgroundUrl" TEXT,
    "priorityScheme" TEXT NOT NULL DEFAULT 'classic',
    "density" TEXT NOT NULL DEFAULT 'comfortable',
    "nudgePrefs" TEXT,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserPreference" ("id", "lastSeenFeedAt", "notificationPrefs", "syncIntervalMins", "syncMode", "targetGrades", "theme", "userId", "widgetLayout") SELECT "id", "lastSeenFeedAt", "notificationPrefs", "syncIntervalMins", "syncMode", "targetGrades", "theme", "userId", "widgetLayout" FROM "UserPreference";
DROP TABLE "UserPreference";
ALTER TABLE "new_UserPreference" RENAME TO "UserPreference";
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Nudge_userId_remindAt_idx" ON "Nudge"("userId", "remindAt");

-- CreateIndex
CREATE UNIQUE INDEX "Nudge_userId_entityType_entityId_category_kind_key" ON "Nudge"("userId", "entityType", "entityId", "category", "kind");

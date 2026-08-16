-- CreateTable
CREATE TABLE "BrightspaceConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokens" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BrightspaceConnection_userId_key" ON "BrightspaceConnection"("userId");

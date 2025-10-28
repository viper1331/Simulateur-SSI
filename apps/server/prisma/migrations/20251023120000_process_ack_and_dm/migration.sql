-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "evacOnDAI" INTEGER NOT NULL DEFAULT 0,
    "evacOnDMDelayMs" INTEGER NOT NULL DEFAULT 5000,
    "processAckRequired" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProcessAck" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "isAcked" INTEGER NOT NULL DEFAULT 0,
    "ackedBy" TEXT,
    "ackedAt" DATETIME,
    "clearedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ManualCallPoint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "zoneId" TEXT NOT NULL,
    "isLatched" INTEGER NOT NULL DEFAULT 0,
    "lastActivatedAt" DATETIME,
    "lastResetAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualCallPoint_zoneId_key" ON "ManualCallPoint"("zoneId");

-- CreateTable
CREATE TABLE "EventLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default singleton rows
INSERT INTO "SiteConfig" ("id") VALUES (1)
ON CONFLICT("id") DO NOTHING;

INSERT INTO "ProcessAck" ("id") VALUES (1)
ON CONFLICT("id") DO NOTHING;

-- Trigger to keep updatedAt in sync
CREATE TRIGGER IF NOT EXISTS "SiteConfig_updatedAt"
AFTER UPDATE ON "SiteConfig"
FOR EACH ROW
BEGIN
  UPDATE "SiteConfig" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

CREATE TRIGGER IF NOT EXISTS "ProcessAck_updatedAt"
AFTER UPDATE ON "ProcessAck"
FOR EACH ROW
BEGIN
  UPDATE "ProcessAck" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."id";
END;

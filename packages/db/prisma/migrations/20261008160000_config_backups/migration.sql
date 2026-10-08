-- Idempotent (IF NOT EXISTS): ein abgebrochenes Update kann die Tabelle schon angelegt haben.
-- CreateTable
CREATE TABLE IF NOT EXISTS "ConfigBackup" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConfigBackup_guildId_createdAt_idx" ON "ConfigBackup"("guildId", "createdAt");


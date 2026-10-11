-- Idempotent (IF NOT EXISTS)
-- Server-Profile (Baupläne für ganze Server) mit Sicherung zum Zurückholen
CREATE TABLE IF NOT EXISTS "ServerProfile" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "backupId" TEXT,
    "created" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "ServerProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ServerProfile_guildId_active_idx" ON "ServerProfile"("guildId", "active");

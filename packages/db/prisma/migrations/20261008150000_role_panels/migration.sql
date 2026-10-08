-- Idempotent (IF NOT EXISTS): ein abgebrochenes Update kann die Tabelle schon angelegt haben.
-- CreateTable
CREATE TABLE IF NOT EXISTS "RolePanel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePanel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RolePanel_guildId_idx" ON "RolePanel"("guildId");


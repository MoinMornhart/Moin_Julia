-- Idempotent (IF NOT EXISTS)
-- Eigene Schlüssel pro Server (KI-Anbieter), verschlüsselt wie die Instanz-Geheimnisse
CREATE TABLE IF NOT EXISTS "GuildSecret" (
    "guildId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "GuildSecret_pkey" PRIMARY KEY ("guildId", "key")
);

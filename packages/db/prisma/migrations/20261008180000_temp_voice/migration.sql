-- Idempotent (IF NOT EXISTS): ein abgebrochenes Update kann die Tabelle schon angelegt haben.
-- CreateTable
CREATE TABLE IF NOT EXISTS "TempVoiceChannel" (
    "channelId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TempVoiceChannel_pkey" PRIMARY KEY ("channelId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TempVoiceChannel_guildId_idx" ON "TempVoiceChannel"("guildId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TempVoiceChannel_guildId_ownerId_idx" ON "TempVoiceChannel"("guildId", "ownerId");

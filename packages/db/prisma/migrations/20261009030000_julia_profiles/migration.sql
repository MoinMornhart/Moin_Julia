-- Idempotent (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "JuliaProfile" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL DEFAULT '',
    "nickname" TEXT,
    "address" TEXT,
    "facts" JSONB NOT NULL DEFAULT '[]',
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "flirtyOptIn" BOOLEAN NOT NULL DEFAULT false,
    "underage" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JuliaProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JuliaProfile_guildId_userId_key" ON "JuliaProfile"("guildId", "userId");

CREATE TABLE IF NOT EXISTS "JuliaChannelMode" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "modeId" TEXT NOT NULL,
    "setBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JuliaChannelMode_pkey" PRIMARY KEY ("guildId", "channelId")
);

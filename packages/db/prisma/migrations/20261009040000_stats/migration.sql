-- Idempotent (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "GuildStatDay" (
    "guildId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "joins" INTEGER NOT NULL DEFAULT 0,
    "leaves" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "voiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GuildStatDay_pkey" PRIMARY KEY ("guildId", "day")
);

CREATE TABLE IF NOT EXISTS "ChannelStatDay" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ChannelStatDay_pkey" PRIMARY KEY ("guildId", "channelId", "day")
);
CREATE INDEX IF NOT EXISTS "ChannelStatDay_guildId_day_idx" ON "ChannelStatDay"("guildId", "day");

CREATE TABLE IF NOT EXISTS "MemberStatDay" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "userTag" TEXT NOT NULL DEFAULT '',
    "messages" INTEGER NOT NULL DEFAULT 0,
    "voiceMinutes" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MemberStatDay_pkey" PRIMARY KEY ("guildId", "userId", "day")
);
CREATE INDEX IF NOT EXISTS "MemberStatDay_guildId_day_idx" ON "MemberStatDay"("guildId", "day");

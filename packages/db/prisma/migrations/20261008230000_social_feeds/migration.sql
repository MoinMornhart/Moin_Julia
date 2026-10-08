-- Idempotent (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "SocialFeed" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialFeed_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SocialFeed_guildId_idx" ON "SocialFeed"("guildId");
CREATE INDEX IF NOT EXISTS "SocialFeed_platform_channelKey_idx" ON "SocialFeed"("platform", "channelKey");

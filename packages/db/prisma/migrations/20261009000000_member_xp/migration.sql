-- Idempotent (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "MemberXp" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "voiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastXpAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberXp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MemberXp_guildId_userId_key" ON "MemberXp"("guildId", "userId");
CREATE INDEX IF NOT EXISTS "MemberXp_guildId_xp_idx" ON "MemberXp"("guildId", "xp");

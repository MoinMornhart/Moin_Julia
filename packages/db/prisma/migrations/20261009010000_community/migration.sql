-- Idempotent (IF NOT EXISTS)
ALTER TABLE "Guild" ADD COLUMN IF NOT EXISTS "suggestionCounter" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "Birthday" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL DEFAULT '',
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER,
    "lastWishedYear" INTEGER,
    "roleGivenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Birthday_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Birthday_guildId_userId_key" ON "Birthday"("guildId", "userId");
CREATE INDEX IF NOT EXISTS "Birthday_guildId_month_day_idx" ON "Birthday"("guildId", "month", "day");

CREATE TABLE IF NOT EXISTS "CountingState" (
    "guildId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "lastUserId" TEXT,
    "record" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CountingState_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE IF NOT EXISTS "Suggestion" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "votes" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "reason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Suggestion_guildId_number_key" ON "Suggestion"("guildId", "number");
CREATE INDEX IF NOT EXISTS "Suggestion_guildId_status_idx" ON "Suggestion"("guildId", "status");

CREATE TABLE IF NOT EXISTS "StarboardEntry" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "starboardMessageId" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StarboardEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StarboardEntry_messageId_key" ON "StarboardEntry"("messageId");
CREATE INDEX IF NOT EXISTS "StarboardEntry_guildId_idx" ON "StarboardEntry"("guildId");

CREATE TABLE IF NOT EXISTS "Giveaway" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "prize" TEXT NOT NULL,
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "requiredRoleId" TEXT,
    "hostId" TEXT NOT NULL,
    "entrants" JSONB NOT NULL DEFAULT '[]',
    "winnerIds" JSONB NOT NULL DEFAULT '[]',
    "endsAt" TIMESTAMP(3) NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Giveaway_guildId_ended_idx" ON "Giveaway"("guildId", "ended");
CREATE INDEX IF NOT EXISTS "Giveaway_ended_endsAt_idx" ON "Giveaway"("ended", "endsAt");

CREATE TABLE IF NOT EXISTS "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT,
    "text" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Reminder_done_dueAt_idx" ON "Reminder"("done", "dueAt");
CREATE INDEX IF NOT EXISTS "Reminder_userId_done_idx" ON "Reminder"("userId", "done");

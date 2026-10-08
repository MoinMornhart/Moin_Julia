-- Idempotent (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "JobPosition" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JobPosition_guildId_idx" ON "JobPosition"("guildId");

CREATE TABLE IF NOT EXISTS "Application" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "userAvatar" TEXT,
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tag" TEXT,
    "handlerId" TEXT,
    "handlerTag" TEXT,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "interview" JSONB,
    "decisionReason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Application_guildId_status_createdAt_idx" ON "Application"("guildId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Application_guildId_userId_positionId_idx" ON "Application"("guildId", "userId", "positionId");

CREATE TABLE IF NOT EXISTS "Probation" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "remindedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    CONSTRAINT "Probation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Probation_guildId_status_idx" ON "Probation"("guildId", "status");

-- Idempotent (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "JuliaUsage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheRead" INTEGER NOT NULL DEFAULT 0,
    "cacheWrite" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "warnedPercent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JuliaUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JuliaUsage_guildId_month_key" ON "JuliaUsage"("guildId", "month");

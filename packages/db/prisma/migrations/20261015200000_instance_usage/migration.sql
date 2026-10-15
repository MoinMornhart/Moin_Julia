-- Idempotent (IF NOT EXISTS)
-- Verbrauch über den KI-Schlüssel der Instanz pro Monat (API-Kostenlimit)
CREATE TABLE IF NOT EXISTS "InstanceUsage" (
    "month" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "warnedPercent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstanceUsage_pkey" PRIMARY KEY ("month")
);

-- Idempotent (IF NOT EXISTS)
-- Eigene Ränge in Server-Vorlagen (Wunsch Philip, 14.10.)
CREATE TABLE IF NOT EXISTS "BlueprintRank" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" INTEGER NOT NULL DEFAULT 0,
    "permissions" TEXT NOT NULL DEFAULT '0',
    "hoist" BOOLEAN NOT NULL DEFAULT false,
    "mentionable" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BlueprintRank_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BlueprintRank_blueprintId_name_key" ON "BlueprintRank"("blueprintId", "name");

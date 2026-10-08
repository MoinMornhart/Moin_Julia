-- Idempotent (IF NOT EXISTS): ein abgebrochenes Update kann die Tabelle schon angelegt haben.
-- CreateTable
CREATE TABLE IF NOT EXISTS "Upload" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Upload_guildId_createdAt_idx" ON "Upload"("guildId", "createdAt");

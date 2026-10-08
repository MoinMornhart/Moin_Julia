-- Idempotent (IF NOT EXISTS): ein abgebrochenes Update kann Teile schon angelegt haben.
-- AlterTable
ALTER TABLE "Guild" ADD COLUMN IF NOT EXISTS "ticketCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TicketPanel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "messageId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Ticket" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "openerId" TEXT NOT NULL,
    "openerTag" TEXT NOT NULL,
    "panelId" TEXT,
    "reasonId" TEXT NOT NULL,
    "reasonLabel" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "claimedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closeReason" TEXT,
    "rating" INTEGER,
    "transcript" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TicketPanel_guildId_idx" ON "TicketPanel"("guildId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_channelId_key" ON "Ticket"("channelId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_guildId_number_key" ON "Ticket"("guildId", "number");
CREATE INDEX IF NOT EXISTS "Ticket_guildId_status_idx" ON "Ticket"("guildId", "status");
CREATE INDEX IF NOT EXISTS "Ticket_guildId_openerId_status_idx" ON "Ticket"("guildId", "openerId", "status");

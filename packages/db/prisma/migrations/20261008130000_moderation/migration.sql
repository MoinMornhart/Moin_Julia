-- CreateEnum
CREATE TYPE "ModCaseType" AS ENUM ('WARN', 'TIMEOUT', 'UNTIMEOUT', 'KICK', 'BAN', 'UNBAN');

-- AlterTable
ALTER TABLE "Guild" ADD COLUMN     "caseCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ModCase" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "ModCaseType" NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "moderatorTag" TEXT NOT NULL,
    "reason" TEXT,
    "durationSec" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'command',
    "logMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModCase_guildId_userId_idx" ON "ModCase"("guildId", "userId");

-- CreateIndex
CREATE INDEX "ModCase_guildId_createdAt_idx" ON "ModCase"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModCase_guildId_number_key" ON "ModCase"("guildId", "number");

-- AddForeignKey
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;


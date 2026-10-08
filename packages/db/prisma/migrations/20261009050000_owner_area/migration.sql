-- Idempotent (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "OwnerRoleBackup" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),
    CONSTRAINT "OwnerRoleBackup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OwnerRoleBackup_guildId_idx" ON "OwnerRoleBackup"("guildId");

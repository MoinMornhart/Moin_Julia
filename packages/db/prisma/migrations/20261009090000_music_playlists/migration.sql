-- Idempotent (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "MusicPlaylist" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tracks" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MusicPlaylist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MusicPlaylist_guildId_ownerId_name_key" ON "MusicPlaylist"("guildId", "ownerId", "name");
CREATE INDEX IF NOT EXISTS "MusicPlaylist_guildId_idx" ON "MusicPlaylist"("guildId");

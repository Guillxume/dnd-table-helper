-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'player';

-- CreateTable
CREATE TABLE "discord_member" (
    "userId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleIds" TEXT[],
    "displayName" TEXT,
    "inGuild" BOOLEAN NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_member_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "discord_member_discordId_key" ON "discord_member"("discordId");

-- AddForeignKey
ALTER TABLE "discord_member" ADD CONSTRAINT "discord_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deux rôles seulement.
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("role" IN ('admin', 'player'));

-- Les comptes existants ont tous été créés en ligne de commande (e-mail et mot de passe) :
-- ce sont des comptes de MJ.
UPDATE "user" SET "role" = 'admin'
WHERE "id" IN (SELECT "userId" FROM "account" WHERE "providerId" = 'credential');

-- Extensions de recherche : trigrammes (sous-chaînes indexées) et suppression des accents.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Normalisation utilisée pour la recherche : minuscules et sans accents.
-- Doit rester alignée sur normalizeForSearch() (src/lib/search/normalize.ts) ;
-- un test d'intégration vérifie la concordance.
CREATE OR REPLACE FUNCTION jdr_normalize(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, input)) $$;

-- CreateEnum
CREATE TYPE "AssetOrigin" AS ENUM ('EXTERNAL', 'GENERATED', 'OWN_WORK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CharacterKind" AS ENUM ('PLAYER_CHARACTER', 'NPC', 'CREATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "TraitStatus" AS ENUM ('CANON', 'PREFERENCE', 'PROPOSAL', 'EXCLUDED', 'UNDETERMINED');

-- CreateEnum
CREATE TYPE "StyleAspect" AS ENUM ('PAINTING_STYLE', 'REALISM', 'SILHOUETTE', 'ANATOMY', 'SHAPES_DETAILS', 'PALETTE', 'SATURATION', 'CONTRAST', 'LIGHTING', 'SHADOWS', 'TEXTURES', 'MATERIALS', 'COSTUME_DESIGN', 'COMPOSITION', 'DEPTH_OF_FIELD', 'DETAIL_DENSITY', 'MAGIC_EFFECTS', 'BACKGROUNDS', 'READABILITY', 'AVOID');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('CHARACTER', 'NPC', 'CREATURE', 'ITEM', 'ENVIRONMENT', 'MAP', 'OTHER');

-- CreateEnum
CREATE TYPE "ReferenceRole" AS ENUM ('STYLE', 'CONTENT', 'STYLE_AND_CONTENT');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('DRAFT', 'TO_REVIEW', 'VALIDATED', 'REJECTED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "artistName" TEXT,
    "sourceUrl" TEXT,
    "origin" "AssetOrigin" NOT NULL DEFAULT 'UNKNOWN',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "creationDate" DATE,
    "categoryId" UUID,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "dominantColor" TEXT,
    "originalKey" TEXT NOT NULL,
    "thumbnailKey" TEXT NOT NULL,
    "previewKey" TEXT NOT NULL,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTag" (
    "assetId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTag_pkey" PRIMARY KEY ("assetId","tagId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverAssetId" UUID,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionAsset" (
    "collectionId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionAsset_pkey" PRIMARY KEY ("collectionId","assetId")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CharacterKind" NOT NULL DEFAULT 'PLAYER_CHARACTER',
    "summary" TEXT,
    "species" TEXT,
    "characterClass" TEXT,
    "specialization" TEXT,
    "silhouette" TEXT,
    "face" TEXT,
    "hairSkin" TEXT,
    "outfit" TEXT,
    "equipment" TEXT,
    "palette" TEXT,
    "symbols" TEXT,
    "personality" TEXT,
    "visualHistory" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterTrait" (
    "id" UUID NOT NULL,
    "characterId" UUID NOT NULL,
    "status" "TraitStatus" NOT NULL,
    "content" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterAsset" (
    "characterId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterAsset_pkey" PRIMARY KEY ("characterId","assetId")
);

-- CreateTable
CREATE TABLE "StyleGuide" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StyleGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleGuideVersion" (
    "id" UUID NOT NULL,
    "styleGuideId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StyleGuideVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleGuideRule" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "aspect" "StyleAspect" NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "StyleGuideRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleGuideAsset" (
    "styleGuideId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "aspects" "StyleAspect"[],
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StyleGuideAsset_pkey" PRIMARY KEY ("styleGuideId","assetId")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "characterId" UUID,
    "styleGuideVersionId" UUID,
    "objective" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "subjectDetails" TEXT,
    "framing" TEXT,
    "aspectRatio" TEXT,
    "highlights" TEXT,
    "constraints" TEXT,
    "exclusions" TEXT,
    "sectionObjective" TEXT NOT NULL,
    "sectionSubject" TEXT NOT NULL,
    "sectionArtDirection" TEXT NOT NULL,
    "sectionReferences" TEXT NOT NULL,
    "sectionComposition" TEXT NOT NULL,
    "sectionLighting" TEXT NOT NULL,
    "sectionMaterials" TEXT NOT NULL,
    "sectionConsistency" TEXT NOT NULL,
    "sectionForbidden" TEXT NOT NULL,
    "sectionOutput" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefReference" (
    "briefId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "role" "ReferenceRole" NOT NULL,
    "aspects" "StyleAspect"[],
    "note" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "BriefReference_pkey" PRIMARY KEY ("briefId","assetId")
);

-- CreateTable
CREATE TABLE "GenerationRecord" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'TO_REVIEW',
    "assetId" UUID,
    "briefId" UUID,
    "characterId" UUID,
    "styleGuideVersionId" UUID,
    "previousId" UUID,
    "prompt" TEXT NOT NULL,
    "briefSnapshot" TEXT,
    "tool" TEXT,
    "sourceUrl" TEXT,
    "revisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationReference" (
    "generationId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "role" "ReferenceRole" NOT NULL,
    "aspects" "StyleAspect"[],
    "note" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GenerationReference_pkey" PRIMARY KEY ("generationId","assetId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_sortOrder_name_idx" ON "Category"("sortOrder", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_sha256_key" ON "Asset"("sha256");

-- CreateIndex
CREATE INDEX "Asset_createdAt_idx" ON "Asset"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Asset_title_idx" ON "Asset"("title");

-- CreateIndex
CREATE INDEX "Asset_creationDate_idx" ON "Asset"("creationDate");

-- CreateIndex
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

-- CreateIndex
CREATE INDEX "Asset_origin_idx" ON "Asset"("origin");

-- CreateIndex
CREATE INDEX "Asset_isFavorite_idx" ON "Asset"("isFavorite");

-- CreateIndex
CREATE INDEX "Asset_searchText_idx" ON "Asset" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_normalized_key" ON "Tag"("normalized");

-- CreateIndex
CREATE INDEX "AssetTag_tagId_idx" ON "AssetTag"("tagId");

-- CreateIndex
CREATE INDEX "Collection_lastViewedAt_idx" ON "Collection"("lastViewedAt" DESC);

-- CreateIndex
CREATE INDEX "Collection_name_idx" ON "Collection"("name");

-- CreateIndex
CREATE INDEX "CollectionAsset_assetId_idx" ON "CollectionAsset"("assetId");

-- CreateIndex
CREATE INDEX "Character_name_idx" ON "Character"("name");

-- CreateIndex
CREATE INDEX "CharacterTrait_characterId_status_position_idx" ON "CharacterTrait"("characterId", "status", "position");

-- CreateIndex
CREATE INDEX "CharacterAsset_assetId_idx" ON "CharacterAsset"("assetId");

-- CreateIndex
CREATE INDEX "StyleGuide_parentId_idx" ON "StyleGuide"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "StyleGuideVersion_styleGuideId_number_key" ON "StyleGuideVersion"("styleGuideId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StyleGuideRule_versionId_aspect_key" ON "StyleGuideRule"("versionId", "aspect");

-- CreateIndex
CREATE INDEX "StyleGuideAsset_assetId_idx" ON "StyleGuideAsset"("assetId");

-- CreateIndex
CREATE INDEX "Brief_updatedAt_idx" ON "Brief"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Brief_characterId_idx" ON "Brief"("characterId");

-- CreateIndex
CREATE INDEX "BriefReference_assetId_idx" ON "BriefReference"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRecord_assetId_key" ON "GenerationRecord"("assetId");

-- CreateIndex
CREATE INDEX "GenerationRecord_createdAt_idx" ON "GenerationRecord"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "GenerationRecord_status_idx" ON "GenerationRecord"("status");

-- CreateIndex
CREATE INDEX "GenerationRecord_characterId_idx" ON "GenerationRecord"("characterId");

-- CreateIndex
CREATE INDEX "GenerationRecord_briefId_idx" ON "GenerationRecord"("briefId");

-- CreateIndex
CREATE INDEX "GenerationRecord_previousId_idx" ON "GenerationRecord"("previousId");

-- CreateIndex
CREATE INDEX "GenerationReference_assetId_idx" ON "GenerationReference"("assetId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTag" ADD CONSTRAINT "AssetTag_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTag" ADD CONSTRAINT "AssetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAsset" ADD CONSTRAINT "CollectionAsset_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAsset" ADD CONSTRAINT "CollectionAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterTrait" ADD CONSTRAINT "CharacterTrait_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAsset" ADD CONSTRAINT "CharacterAsset_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAsset" ADD CONSTRAINT "CharacterAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleGuide" ADD CONSTRAINT "StyleGuide_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StyleGuide"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleGuideVersion" ADD CONSTRAINT "StyleGuideVersion_styleGuideId_fkey" FOREIGN KEY ("styleGuideId") REFERENCES "StyleGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleGuideRule" ADD CONSTRAINT "StyleGuideRule_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "StyleGuideVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleGuideAsset" ADD CONSTRAINT "StyleGuideAsset_styleGuideId_fkey" FOREIGN KEY ("styleGuideId") REFERENCES "StyleGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleGuideAsset" ADD CONSTRAINT "StyleGuideAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_styleGuideVersionId_fkey" FOREIGN KEY ("styleGuideVersionId") REFERENCES "StyleGuideVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefReference" ADD CONSTRAINT "BriefReference_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefReference" ADD CONSTRAINT "BriefReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRecord" ADD CONSTRAINT "GenerationRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRecord" ADD CONSTRAINT "GenerationRecord_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "Brief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRecord" ADD CONSTRAINT "GenerationRecord_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRecord" ADD CONSTRAINT "GenerationRecord_styleGuideVersionId_fkey" FOREIGN KEY ("styleGuideVersionId") REFERENCES "StyleGuideVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRecord" ADD CONSTRAINT "GenerationRecord_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "GenerationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationReference" ADD CONSTRAINT "GenerationReference_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "GenerationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationReference" ADD CONSTRAINT "GenerationReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

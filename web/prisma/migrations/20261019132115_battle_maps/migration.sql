-- CreateEnum
CREATE TYPE "GridStyle" AS ENUM ('DARK', 'LIGHT');

-- CreateTable
CREATE TABLE "BattleMap" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "assetId" UUID NOT NULL,
    "columns" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "cellTenthMm" INTEGER NOT NULL DEFAULT 250,
    "gridStyle" "GridStyle" NOT NULL DEFAULT 'DARK',
    "gridOpacity" INTEGER NOT NULL DEFAULT 60,
    "showLabels" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BattleMap_assetId_idx" ON "BattleMap"("assetId");

-- CreateIndex
CREATE INDEX "BattleMap_updatedAt_idx" ON "BattleMap"("updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "BattleMap" ADD CONSTRAINT "BattleMap_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garde-fous du quadrillage (mêmes bornes que src/lib/battle-map/layout.ts).
ALTER TABLE "BattleMap" ADD CONSTRAINT "BattleMap_grid_check"
  CHECK ("columns" BETWEEN 2 AND 120 AND "rows" BETWEEN 2 AND 120
         AND "cellTenthMm" IN (250, 254) AND "gridOpacity" BETWEEN 10 AND 100);

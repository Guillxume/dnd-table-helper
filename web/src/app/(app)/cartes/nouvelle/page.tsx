import type { Metadata } from "next";
import { z } from "zod";
import { BattleMapForm } from "@/components/battle-maps/battle-map-form";
import { PageHeader } from "@/components/shared/page-header";
import { rowsForImage } from "@/lib/battle-map/layout";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Nouvelle carte de bataille" };

const DEFAULT_COLUMNS = 20;

export default async function NewBattleMapPage({ searchParams }: PageProps<"/cartes/nouvelle">) {
  await requireUser();
  const { asset: assetParam } = await searchParams;
  const assetId = z.uuid().safeParse(assetParam).data;
  const asset = assetId
    ? await getDb().asset.findUnique({
        where: { id: assetId },
        select: { id: true, title: true, width: true, height: true, dominantColor: true },
      })
    : null;

  return (
    <>
      <PageHeader
        title="Nouvelle carte de bataille"
        description="Réglez le nombre de cases : l'aperçu montre le quadrillage et le découpage en feuilles A4, à l'échelle de vos figurines."
      />
      <BattleMapForm
        initial={{
          title: asset?.title ?? "",
          asset,
          columns: DEFAULT_COLUMNS,
          rows: asset ? rowsForImage(DEFAULT_COLUMNS, asset.width, asset.height) : 14,
          cellTenthMm: 250,
          gridStyle: "DARK",
          gridOpacity: 60,
          showLabels: true,
          notes: "",
        }}
      />
    </>
  );
}

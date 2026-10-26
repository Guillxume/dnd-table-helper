import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BattleMapForm } from "@/components/battle-maps/battle-map-form";
import { PageHeader } from "@/components/shared/page-header";
import { getBattleMap } from "@/server/battle-maps/battle-maps";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Carte de bataille" };

export default async function BattleMapPage({ params }: PageProps<"/cartes/[mapId]">) {
  await requireUser();
  const { mapId } = await params;
  if (!z.uuid().safeParse(mapId).success) notFound();
  const map = await getBattleMap(mapId);
  if (!map) notFound();
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/cartes" className="hover:text-foreground hover:underline">
            Cartes de bataille
          </Link>
        }
        title={map.title}
      />
      <BattleMapForm
        key={map.updatedAt.toISOString()}
        mapId={map.id}
        initial={{
          title: map.title,
          asset: { id: map.asset.id, title: map.asset.title, width: map.asset.width, height: map.asset.height, dominantColor: map.asset.dominantColor },
          columns: map.columns,
          rows: map.rows,
          cellTenthMm: map.cellTenthMm,
          gridStyle: map.gridStyle,
          gridOpacity: map.gridOpacity,
          showLabels: map.showLabels,
          notes: map.notes ?? "",
        }}
      />
    </>
  );
}

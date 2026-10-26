import { FileDown, Map as MapIcon, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AssetImage } from "@/components/shared/asset-image";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { describeBattleMap, listBattleMaps } from "@/server/battle-maps/battle-maps";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Cartes de bataille" };

export default async function BattleMapsPage() {
  await requireUser();
  const maps = await listBattleMaps();
  const newButton = (
    <Button asChild>
      <Link href="/cartes/nouvelle">
        <Plus aria-hidden />
        Nouvelle carte
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Cartes de bataille"
        description="Une image vue du dessus, quadrillée par le site et imprimée à l'échelle des figurines sur des feuilles A4 à assembler."
        actions={newButton}
      />
      {maps.length === 0 ? (
        <EmptyState icon={MapIcon} title="Aucune carte" action={newButton}>
          Préparez l&apos;image dans l&apos;atelier (sujet « Carte »), archivez la génération, puis créez la carte à partir de cette image.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {maps.map((map) => {
            const { layout } = describeBattleMap(map);
            return (
              <li key={map.id} className="overflow-hidden rounded-xl border bg-card">
                {/* Doublon du lien de titre : retiré de la tabulation et des lecteurs d'écran. */}
                <Link href={`/cartes/${map.id}`} tabIndex={-1} aria-hidden className="block">
                  <div className="overflow-hidden bg-muted" style={{ aspectRatio: `${map.columns} / ${map.rows}` }}>
                    <AssetImage
                      assetId={map.asset.id}
                      alt=""
                      width={map.asset.width}
                      height={map.asset.height}
                      dominantColor={map.asset.dominantColor}
                      className="h-full"
                    />
                  </div>
                </Link>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <Link href={`/cartes/${map.id}`} className="block truncate font-medium hover:underline">
                      {map.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {map.columns} × {map.rows} cases · {layout.pages.length} feuille{layout.pages.length > 1 ? "s" : ""} A4
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/battle-maps/${map.id}/pdf`} aria-label={`Télécharger le PDF de ${map.title}`}>
                      <FileDown aria-hidden />
                      PDF
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

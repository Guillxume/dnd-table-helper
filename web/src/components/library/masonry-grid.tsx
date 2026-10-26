"use client";

import { Check, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssetImage } from "@/components/shared/asset-image";
import { cn } from "@/lib/utils";

export type GridAsset = {
  id: string;
  title: string;
  width: number;
  height: number;
  dominantColor: string | null;
  isFavorite: boolean;
};

const MIN_COLUMN_WIDTH = 220;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 7;

function useColumnCount(ref: React.RefObject<HTMLDivElement | null>) {
  const [columns, setColumns] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumns(Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.floor(width / MIN_COLUMN_WIDTH))));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}

/**
 * Mosaïque à colonnes : chaque image va dans la colonne la moins haute, d'après
 * ses dimensions connues (aucune mesure après chargement, donc aucun saut de mise
 * en page). Ajouter une page ne déplace pas les images déjà placées.
 */
export function MasonryGrid({
  items,
  linkQuery = "",
  selectable = false,
  selected,
  onToggleSelect,
  onToggleFavorite,
}: {
  items: GridAsset[];
  /** Paramètres ajoutés au lien de chaque fiche (contexte de navigation ← →), ex. « ?q=elf ». */
  linkQuery?: string;
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onToggleSelect?: (id: string, event: React.MouseEvent | React.KeyboardEvent) => void;
  onToggleFavorite?: (asset: GridAsset) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(containerRef);

  const columns = useMemo(() => {
    if (!columnCount) return [];
    const result: GridAsset[][] = Array.from({ length: columnCount }, () => []);
    const heights = new Array<number>(columnCount).fill(0);
    for (const item of items) {
      const target = heights.indexOf(Math.min(...heights));
      result[target].push(item);
      heights[target] += item.height / item.width;
    }
    return result;
  }, [items, columnCount]);

  return (
    <div ref={containerRef} className="w-full">
      {columnCount === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
          {items.slice(0, 8).map((item) => (
            <div key={item.id} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-3" role="region" aria-label="Illustrations">
          {columns.map((column, index) => (
            <ul key={index} className="flex min-w-0 flex-1 flex-col gap-3">
              {column.map((item) => (
                <AssetTile
                  key={item.id}
                  asset={item}
                  href={`/library/${item.id}${linkQuery}`}
                  selectable={selectable}
                  selected={selected?.has(item.id) ?? false}
                  onToggleSelect={onToggleSelect}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetTile({
  asset,
  href,
  selectable,
  selected,
  onToggleSelect,
  onToggleFavorite,
}: {
  asset: GridAsset;
  href: string;
  selectable: boolean;
  selected: boolean;
  onToggleSelect?: (id: string, event: React.MouseEvent | React.KeyboardEvent) => void;
  onToggleFavorite?: (asset: GridAsset) => void;
}) {
  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-lg bg-muted ring-offset-2 ring-offset-background transition-shadow",
        selected && "ring-2 ring-primary",
      )}
    >
      <Link
        href={href}
        onClick={(event) => {
          // En mode sélection, un clic sélectionne au lieu d'ouvrir la fiche.
          if (selectable && onToggleSelect) {
            event.preventDefault();
            onToggleSelect(asset.id, event);
          }
        }}
        className="block outline-none focus-visible:ring-3 focus-visible:ring-ring"
        aria-label={selectable ? `${selected ? "Désélectionner" : "Sélectionner"} ${asset.title}` : asset.title}
      >
        <div style={{ aspectRatio: `${asset.width} / ${asset.height}` }}>
          <AssetImage
            assetId={asset.id}
            alt={asset.title}
            width={asset.width}
            height={asset.height}
            dominantColor={asset.dominantColor}
            className="h-full transition-transform duration-300 group-hover:scale-[1.015]"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-6 pb-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <p className="truncate text-xs font-medium text-white">{asset.title}</p>
        </div>
      </Link>

      {onToggleSelect ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Sélectionner ${asset.title}`}
          onClick={(event) => onToggleSelect(asset.id, event)}
          className={cn(
            "absolute top-2 left-2 flex size-6 items-center justify-center rounded-md border border-white/40 bg-black/50 text-white outline-none backdrop-blur transition-opacity focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring",
            selected ? "border-primary bg-primary text-primary-foreground opacity-100" : "opacity-0 group-hover:opacity-100",
            selectable && "opacity-100",
          )}
        >
          {selected ? <Check className="size-4" aria-hidden /> : null}
        </button>
      ) : null}

      {onToggleFavorite ? (
        <button
          type="button"
          aria-pressed={asset.isFavorite}
          aria-label={asset.isFavorite ? `Retirer ${asset.title} des favoris` : `Ajouter ${asset.title} aux favoris`}
          onClick={() => onToggleFavorite(asset)}
          className={cn(
            "absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-black/50 text-white outline-none backdrop-blur transition-opacity focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring",
            asset.isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Star className={cn("size-4", asset.isFavorite && "fill-primary text-primary")} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { CheckSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadAssetsPageAction, setFavoriteAction } from "@/app/(app)/library/actions";
import { Button } from "@/components/ui/button";
import type { LibraryFilters } from "@/lib/library-filters";
import { pluralize } from "@/lib/text";
import { BulkActionBar } from "./bulk-action-bar";
import { LibraryFilterBar, type LibraryOptions, type LockedFilters } from "./library-filter-bar";
import { type GridAsset, MasonryGrid } from "./masonry-grid";

type LibraryViewProps = {
  initialItems: GridAsset[];
  total: number;
  filters: LibraryFilters;
  /** Filtres sérialisés, y compris les filtres verrouillés de la page. */
  queryString: string;
  options: LibraryOptions;
  locked?: LockedFilters;
  emptyState: ReactNode;
};

/**
 * Galerie complète : filtres (dans l'URL), mosaïque, chargement progressif
 * maîtrisé par un bouton, sélection multiple et actions en masse.
 *
 * La barre de filtres reste montée (la saisie en cours garde le focus) ;
 * les résultats repartent d'un état vierge à chaque changement de filtres.
 */
export function LibraryView(props: LibraryViewProps) {
  return (
    <div>
      <LibraryFilterBar filters={props.filters} options={props.options} locked={props.locked} />
      <LibraryResults key={props.queryString} {...props} />
    </div>
  );
}

function LibraryResults({ initialItems, total, queryString, options, locked, emptyState }: LibraryViewProps) {
  const router = useRouter();
  const [extraItems, setExtraItems] = useState<GridAsset[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [favoriteOverrides, setFavoriteOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [loadingMore, startLoading] = useTransition();

  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...initialItems, ...extraItems]
      .filter((item) => {
        // Une page chargée après une insertion peut recouvrir la précédente.
        if (seen.has(item.id) || removed.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map((item) => (favoriteOverrides.has(item.id) ? { ...item, isFavorite: favoriteOverrides.get(item.id)! } : item));
  }, [initialItems, extraItems, removed, favoriteOverrides]);

  const loadedCount = initialItems.length + extraItems.length;
  const hasMore = loadedCount < total;

  function loadMore() {
    startLoading(async () => {
      const result = await loadAssetsPageAction(queryString, loadedCount);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Chargement impossible." : result.error);
        return;
      }
      const page = result.data.items;
      setExtraItems((current) => [...current, ...page]);
    });
  }

  function toggleSelect(id: string, event: React.MouseEvent | React.KeyboardEvent) {
    setSelectionMode(true);
    setSelected((current) => {
      const next = new Set(current);
      // Maj + clic : sélectionne toute la plage depuis le dernier élément cliqué.
      if (event.shiftKey && lastClicked) {
        const ids = items.map((item) => item.id);
        const [from, to] = [ids.indexOf(lastClicked), ids.indexOf(id)].sort((a, b) => a - b);
        if (from !== -1) for (const rangeId of ids.slice(from, to + 1)) next.add(rangeId);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastClicked(id);
  }

  async function toggleFavorite(asset: GridAsset) {
    const value = !asset.isFavorite;
    setFavoriteOverrides((current) => new Map(current).set(asset.id, value));
    const result = await setFavoriteAction([asset.id], value);
    if (!result.ok) {
      setFavoriteOverrides((current) => new Map(current).set(asset.id, !value));
      toast.error(result.error);
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectionMode(false);
  }

  const detailQuery = queryString ? `?${queryString}` : "";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          {total === 0
            ? "Aucune illustration"
            : `${pluralize(items.length, "illustration affichée", "illustrations affichées")} sur ${total.toLocaleString("fr-FR")}`}
        </p>
        {total > 0 ? (
          <Button
            variant={selectionMode ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={selectionMode}
            onClick={() => (selectionMode ? clearSelection() : setSelectionMode(true))}
          >
            <CheckSquare aria-hidden />
            {selectionMode ? "Terminer la sélection" : "Sélectionner"}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        emptyState
      ) : (
        <MasonryGrid
          items={items}
          linkQuery={detailQuery}
          selectable={selectionMode}
          selected={selected}
          onToggleSelect={toggleSelect}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {hasMore ? (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <D20Loader /> : null}
            Charger plus ({(total - loadedCount).toLocaleString("fr-FR")} restantes)
          </Button>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <BulkActionBar
          selectedIds={[...selected]}
          options={options}
          currentCollectionId={locked?.collectionId}
          allSelected={selected.size >= items.length}
          onSelectAll={() => setSelected(new Set(items.map((item) => item.id)))}
          onClear={clearSelection}
          onChanged={(change) => {
            if (change?.removed) {
              const removedIds = change.removed;
              setRemoved((current) => new Set([...current, ...removedIds]));
              clearSelection();
            }
            if (change?.favorite !== undefined) {
              const value = change.favorite;
              setFavoriteOverrides((current) => {
                const next = new Map(current);
                for (const id of selected) next.set(id, value);
                return next;
              });
            }
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

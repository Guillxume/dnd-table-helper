"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { Check, ImagePlus, Search } from "lucide-react";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { pickerSearchAction } from "@/app/(app)/library/actions";
import { AssetImage } from "@/components/shared/asset-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { pluralize } from "@/lib/text";
import { cn } from "@/lib/utils";

export type PickedAsset = {
  id: string;
  title: string;
  width: number;
  height: number;
  dominantColor: string | null;
};

/**
 * Dialogue de sélection d'illustrations dans la bibliothèque (recherche + sélection multiple).
 */
export function AssetPicker({
  trigger,
  title = "Choisir des illustrations",
  description = "Recherchez dans la bibliothèque puis sélectionnez une ou plusieurs images.",
  excludeIds = [],
  max,
  confirmLabel = "Ajouter",
  onConfirm,
}: {
  trigger?: ReactNode;
  title?: string;
  description?: string;
  excludeIds?: readonly string[];
  max?: number;
  confirmLabel?: string;
  onConfirm: (assets: PickedAsset[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PickedAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Map<string, PickedAsset>>(new Map());
  const [loading, startLoading] = useTransition();
  const [confirming, startConfirm] = useTransition();
  const excluded = new Set(excludeIds);

  function load(search: string, offset: number) {
    startLoading(async () => {
      const result = await pickerSearchAction(search, offset);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Recherche impossible." : result.error);
        return;
      }
      const page = result.data;
      setItems((current) => (offset === 0 ? page.items : [...current, ...page.items]));
      setTotal(page.total);
    });
  }

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => load(query.trim(), 0), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, query]);

  function toggle(asset: PickedAsset) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(asset.id)) next.delete(asset.id);
      else if (!max || next.size < max) next.set(asset.id, asset);
      else toast.info(`Au plus ${max} image${max > 1 ? "s" : ""}.`);
      return next;
    });
  }

  function confirm() {
    startConfirm(async () => {
      await onConfirm([...selected.values()]);
      setOpen(false);
      setSelected(new Map());
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelected(new Map());
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <ImagePlus aria-hidden />
            Choisir dans la bibliothèque
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher par titre, tag, collection…"
            aria-label="Rechercher une illustration"
            className="pl-8"
          />
        </div>
        <div className="min-h-48 flex-1 overflow-y-auto">
          {items.length === 0 && !loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune illustration trouvée.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Résultats">
              {items.map((asset) => {
                const isExcluded = excluded.has(asset.id);
                const isSelected = selected.has(asset.id);
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      disabled={isExcluded}
                      aria-pressed={isSelected}
                      onClick={() => toggle(asset)}
                      title={isExcluded ? `${asset.title} (déjà ajoutée)` : asset.title}
                      className={cn(
                        "relative block aspect-square w-full overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring",
                        isSelected && "ring-2 ring-primary",
                        isExcluded && "opacity-35",
                      )}
                    >
                      <AssetImage
                        assetId={asset.id}
                        alt={asset.title}
                        width={asset.width}
                        height={asset.height}
                        dominantColor={asset.dominantColor}
                        className="h-full"
                      />
                      {isSelected ? (
                        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded bg-primary text-primary-foreground">
                          <Check className="size-3.5" aria-hidden />
                        </span>
                      ) : null}
                      <span className="sr-only">{asset.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length < total ? (
            <div className="mt-3 flex justify-center">
              <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => load(query.trim(), items.length)}>
                {loading ? <D20Loader /> : null}
                Charger plus
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {pluralize(selected.size, "image sélectionnée", "images sélectionnées")}
          </span>
          <Button type="button" onClick={confirm} disabled={selected.size === 0 || confirming}>
            {confirming ? <D20Loader /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { Check, ChevronsUpDown, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { NativeSelect } from "@/components/shared/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AssetOrigin } from "@/generated/prisma/enums";
import { ASSET_ORIGIN_LABELS } from "@/lib/labels";
import {
  ASSET_SORTS,
  type AssetSort,
  hasActiveFilters,
  type LibraryFilters,
  libraryFiltersToSearchParams,
} from "@/lib/library-filters";
import { cn } from "@/lib/utils";

export type Option = { id: string; name: string };
export type LibraryOptions = { categories: Option[]; collections: Option[]; tags: Option[] };

/** Filtres imposés par la page (ex. : la collection affichée) : non modifiables ici. */
export type LockedFilters = Partial<Pick<LibraryFilters, "collectionId" | "categoryId">>;

export function LibraryFilterBar({
  filters,
  options,
  locked = {},
}: {
  filters: LibraryFilters;
  options: LibraryOptions;
  locked?: LockedFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");
  // Sur mobile, les filtres secondaires sont repliés par défaut.
  const [expanded, setExpanded] = useState(false);

  // Resynchronise le champ si l'URL change par ailleurs (bouton précédent, lien),
  // sans écraser la saisie en cours (espaces finaux compris).
  const [syncedQ, setSyncedQ] = useState(filters.q ?? "");
  if ((filters.q ?? "") !== syncedQ) {
    setSyncedQ(filters.q ?? "");
    if ((filters.q ?? "") !== query.trim()) setQuery(filters.q ?? "");
  }

  function apply(patch: Partial<LibraryFilters>) {
    const next = { ...filters, ...patch, ...locked };
    const params = libraryFiltersToSearchParams(next);
    // Les filtres verrouillés font partie du chemin de la page, pas de l'URL.
    if (locked.collectionId) params.delete("collection");
    if (locked.categoryId) params.delete("category");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Recherche appliquée après une courte pause de frappe.
  useEffect(() => {
    if ((filters.q ?? "") === query.trim()) return;
    const timer = setTimeout(() => apply({ q: query.trim() || undefined }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply dépend des filtres courants, la pause suffit
  }, [query]);

  const tagNames = new Map(options.tags.map((tag) => [tag.id, tag.name]));
  const active = hasActiveFilters({ ...filters, collectionId: locked.collectionId ? undefined : filters.collectionId });

  return (
    <section aria-label="Filtres" className="mb-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply({ q: query.trim() || undefined });
            }}
            placeholder="Titre, description, tags, collections, personnages, notes…"
            aria-label="Rechercher dans la bibliothèque"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="library-sort" className="sr-only">
            Trier par
          </Label>
          <NativeSelect
            id="library-sort"
            value={filters.sort}
            onChange={(event) => apply({ sort: event.target.value as AssetSort })}
            className="h-9 sm:w-60"
          >
            {Object.entries(ASSET_SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant={active ? "secondary" : "outline"}
            className="h-9 sm:hidden"
            aria-expanded={expanded}
            aria-controls="library-secondary-filters"
            onClick={() => setExpanded((value) => !value)}
          >
            <SlidersHorizontal aria-hidden />
            Filtres
          </Button>
          {pending ? <D20Loader className="size-4 text-muted-foreground" label="Mise à jour…" /> : null}
        </div>
      </div>

      <div
        id="library-secondary-filters"
        className={cn("flex-wrap items-center gap-2 sm:flex", expanded ? "flex" : "hidden")}
      >
        {locked.categoryId ? null : (
          <NativeSelect
            aria-label="Catégorie"
            value={filters.categoryId ?? ""}
            onChange={(event) => apply({ categoryId: event.target.value || undefined })}
            className="w-full sm:w-auto sm:max-w-52"
          >
            <option value="">Toutes catégories</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        )}
        {locked.collectionId ? null : (
          <NativeSelect
            aria-label="Collection"
            value={filters.collectionId ?? ""}
            onChange={(event) => apply({ collectionId: event.target.value || undefined })}
            className="w-full sm:w-auto sm:max-w-52"
          >
            <option value="">Toutes collections</option>
            {options.collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          aria-label="Origine"
          value={filters.origin ?? ""}
          onChange={(event) => apply({ origin: (event.target.value || undefined) as AssetOrigin | undefined })}
          className="w-full sm:w-auto"
        >
          <option value="">Toutes origines</option>
          {Object.values(AssetOrigin).map((origin) => (
            <option key={origin} value={origin}>
              {ASSET_ORIGIN_LABELS[origin]}
            </option>
          ))}
        </NativeSelect>
        <TagMultiSelect
          tags={options.tags}
          selected={filters.tagIds}
          onChange={(tagIds) => apply({ tagIds })}
        />
        <Button
          type="button"
          variant={filters.favorite ? "secondary" : "outline"}
          aria-pressed={filters.favorite}
          onClick={() => apply({ favorite: !filters.favorite })}
        >
          <Star className={cn(filters.favorite && "fill-primary text-primary")} aria-hidden />
          Favoris
        </Button>
        <div className="flex w-full flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:w-auto">
          <Label htmlFor="library-from" className="font-normal">
            Importées du
          </Label>
          <Input
            id="library-from"
            type="date"
            value={filters.importedFrom ?? ""}
            max={filters.importedTo}
            onChange={(event) => apply({ importedFrom: event.target.value || undefined })}
            className="h-8 min-w-0 flex-1 sm:w-36 sm:flex-none"
          />
          <Label htmlFor="library-to" className="font-normal">
            au
          </Label>
          <Input
            id="library-to"
            type="date"
            value={filters.importedTo ?? ""}
            min={filters.importedFrom}
            onChange={(event) => apply({ importedTo: event.target.value || undefined })}
            className="h-8 min-w-0 flex-1 sm:w-36 sm:flex-none"
          />
        </div>
        {active ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setQuery("");
              apply({
                q: undefined,
                categoryId: undefined,
                collectionId: undefined,
                tagIds: [],
                favorite: false,
                origin: undefined,
                importedFrom: undefined,
                importedTo: undefined,
              });
            }}
          >
            <X aria-hidden />
            Réinitialiser
          </Button>
        ) : null}
      </div>

      {filters.tagIds.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags filtrés">
          {filters.tagIds.map((tagId) => (
            <li key={tagId}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {tagNames.get(tagId) ?? "Tag supprimé"}
                <button
                  type="button"
                  className="rounded-sm p-0.5 outline-none hover:bg-background/40 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Retirer le filtre ${tagNames.get(tagId) ?? ""}`}
                  onClick={() => apply({ tagIds: filters.tagIds.filter((id) => id !== tagId) })}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function TagMultiSelect({
  tags,
  selected,
  onChange,
}: {
  tags: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={tags.length === 0}>
          Tags{selected.length > 0 ? ` (${selected.length})` : ""}
          <ChevronsUpDown className="opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Filtrer les tags…" />
          <CommandList>
            <CommandEmpty>Aucun tag.</CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => {
                const isSelected = selectedSet.has(tag.id);
                return (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() =>
                      onChange(isSelected ? selected.filter((id) => id !== tag.id) : [...selected, tag.id])
                    }
                  >
                    <Check className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")} aria-hidden />
                    {tag.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

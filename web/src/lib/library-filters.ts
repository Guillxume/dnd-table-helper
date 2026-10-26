import { z } from "zod";
import { AssetOrigin } from "@/generated/prisma/enums";

/**
 * Filtres de la galerie, portés par l'URL (?q=…&tag=…) pour que chaque vue
 * filtrée ait une adresse stable, partageable et rechargeable.
 */
export const ASSET_SORTS = {
  "imported-desc": "Import le plus récent",
  "imported-asc": "Import le plus ancien",
  "title-asc": "Titre (A → Z)",
  "title-desc": "Titre (Z → A)",
  "created-desc": "Création de l'œuvre (récente)",
  "created-asc": "Création de l'œuvre (ancienne)",
} as const;

export type AssetSort = keyof typeof ASSET_SORTS;

const uuid = z.uuid();
const isoDate = z.iso.date();

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function valid<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export type LibraryFilters = {
  q?: string;
  categoryId?: string;
  /** Tous les tags doivent être présents (ET). */
  tagIds: string[];
  collectionId?: string;
  favorite: boolean;
  origin?: AssetOrigin;
  importedFrom?: string;
  importedTo?: string;
  sort: AssetSort;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Convertit des URLSearchParams (paramètres répétés compris) au format des searchParams de page. */
export function searchParamsToRecord(params: URLSearchParams): RawSearchParams {
  const record: RawSearchParams = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    record[key] = values.length > 1 ? values : values[0];
  }
  return record;
}

/** Lecture tolérante : un paramètre invalide est ignoré plutôt que de casser la page. */
export function parseLibraryFilters(params: RawSearchParams): LibraryFilters {
  const q = first(params.q)?.trim().slice(0, 200);
  const sortParam = first(params.sort);
  return {
    q: q || undefined,
    categoryId: valid(uuid, first(params.category)),
    tagIds: [...new Set(all(params.tag).filter((value) => uuid.safeParse(value).success))].slice(0, 10),
    collectionId: valid(uuid, first(params.collection)),
    favorite: first(params.favorite) === "1",
    origin: valid(z.enum(AssetOrigin), first(params.origin)),
    importedFrom: valid(isoDate, first(params.from)),
    importedTo: valid(isoDate, first(params.to)),
    sort: sortParam && Object.hasOwn(ASSET_SORTS, sortParam) ? (sortParam as AssetSort) : "imported-desc",
  };
}

/** Sérialisation inverse, utilisée pour construire les liens et l'URL après un changement de filtre. */
export function libraryFiltersToSearchParams(filters: Partial<LibraryFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.categoryId) params.set("category", filters.categoryId);
  for (const tagId of filters.tagIds ?? []) params.append("tag", tagId);
  if (filters.collectionId) params.set("collection", filters.collectionId);
  if (filters.favorite) params.set("favorite", "1");
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.importedFrom) params.set("from", filters.importedFrom);
  if (filters.importedTo) params.set("to", filters.importedTo);
  if (filters.sort && filters.sort !== "imported-desc") params.set("sort", filters.sort);
  return params;
}

export function hasActiveFilters(filters: LibraryFilters): boolean {
  return Boolean(
    filters.q ||
      filters.categoryId ||
      filters.tagIds.length > 0 ||
      filters.collectionId ||
      filters.favorite ||
      filters.origin ||
      filters.importedFrom ||
      filters.importedTo,
  );
}

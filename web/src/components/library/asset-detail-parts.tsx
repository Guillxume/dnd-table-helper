"use client";

import { ChevronLeft, ChevronRight, Download, Expand, Plus, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addTagsAction,
  addToCollectionAction,
  deleteAssetsAction,
  removeFromCollectionAction,
  removeTagAction,
  setFavoriteAction,
  updateAssetMetadataAction,
} from "@/app/(app)/library/actions";
import { AssetImage, assetFileUrl } from "@/components/shared/asset-image";
import { ConfirmAction } from "@/components/shared/confirm-action";
import {
  fieldError,
  FormMessage,
  NativeSelect,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  useFormAction,
} from "@/components/shared/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssetOrigin } from "@/generated/prisma/enums";
import { ASSET_ORIGIN_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Option } from "./library-filter-bar";
import { ZoomViewer } from "./zoom-viewer";

type ViewerAsset = { id: string; title: string; width: number; height: number; dominantColor: string | null };

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/** Aperçu, plein écran et navigation ← → dans la vue filtrée d'origine. */
export function AssetViewer({
  asset,
  previousHref,
  nextHref,
  position,
}: {
  asset: ViewerAsset;
  previousHref: string | null;
  nextHref: string | null;
  position: string | null;
}) {
  const router = useRouter();
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (zoomOpen || isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft" && previousHref) router.push(previousHref);
      else if (event.key === "ArrowRight" && nextHref) router.push(nextHref);
      else if (event.key === "z" || event.key === "Z") setZoomOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previousHref, nextHref, router, zoomOpen]);

  return (
    <div className="space-y-3">
      <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-checker">
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="block w-full cursor-zoom-in outline-none focus-visible:ring-3 focus-visible:ring-ring"
          aria-label={`Agrandir ${asset.title} (touche Z)`}
        >
          <div className="mx-auto max-h-[78vh]" style={{ aspectRatio: `${asset.width} / ${asset.height}`, maxWidth: `min(100%, calc(78vh * ${asset.width / asset.height}))` }}>
            <AssetImage
              assetId={asset.id}
              alt={asset.title}
              width={asset.width}
              height={asset.height}
              variant="preview"
              dominantColor={asset.dominantColor}
              eager
              fit="contain"
              className="h-full"
            />
          </div>
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <NavButton href={previousHref} label="Illustration précédente (←)" icon={<ChevronLeft aria-hidden />} />
          <NavButton href={nextHref} label="Illustration suivante (→)" icon={<ChevronRight aria-hidden />} />
          {position ? <span className="px-1 text-xs text-muted-foreground">{position}</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setZoomOpen(true)}>
            <Expand aria-hidden />
            Zoom
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`${assetFileUrl(asset.id, "original")}?download=1`}>
              <Download aria-hidden />
              Original
            </a>
          </Button>
        </div>
      </div>
      <ZoomViewer
        open={zoomOpen}
        onOpenChange={setZoomOpen}
        assetId={asset.id}
        title={asset.title}
        width={asset.width}
        height={asset.height}
      />
    </div>
  );
}

function NavButton({ href, label, icon }: { href: string | null; label: string; icon: React.ReactNode }) {
  if (!href) {
    return (
      <Button variant="ghost" size="icon-sm" disabled aria-label={label}>
        {icon}
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="icon-sm" asChild>
      <Link href={href} aria-label={label} title={label}>
        {icon}
      </Link>
    </Button>
  );
}

export function FavoriteToggle({ assetId, isFavorite }: { assetId: string; isFavorite: boolean }) {
  const [value, setValue] = useState(isFavorite);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={value}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const next = !value;
          setValue(next);
          const result = await setFavoriteAction([assetId], next);
          if (!result.ok) {
            setValue(!next);
            toast.error(result.error);
          }
        })
      }
    >
      <Star className={cn(value && "fill-primary text-primary")} aria-hidden />
      {value ? "Favori" : "Ajouter aux favoris"}
    </Button>
  );
}

export type MetadataDefaults = {
  title: string;
  description: string | null;
  notes: string | null;
  artistName: string | null;
  sourceUrl: string | null;
  origin: AssetOrigin;
  categoryId: string | null;
  creationDate: string | null;
};

export function MetadataForm({
  assetId,
  defaults,
  categories,
}: {
  assetId: string;
  defaults: MetadataDefaults;
  categories: Option[];
}) {
  const [state, formAction] = useFormAction(updateAssetMetadataAction.bind(null, assetId));

  return (
    <form action={formAction} className="space-y-3">
      <TextField label="Titre" name="title" defaultValue={defaults.title} required maxLength={200} error={fieldError(state, "title")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Provenance" name="origin" defaultValue={defaults.origin}>
          {Object.values(AssetOrigin).map((origin) => (
            <option key={origin} value={origin}>
              {ASSET_ORIGIN_LABELS[origin]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Catégorie" name="categoryId" defaultValue={defaults.categoryId ?? ""}>
          <option value="">Sans catégorie</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Artiste" name="artistName" defaultValue={defaults.artistName ?? ""} placeholder="Inconnu" maxLength={200} />
        <TextField
          label="Date de création de l'œuvre"
          name="creationDate"
          type="date"
          defaultValue={defaults.creationDate ?? ""}
          error={fieldError(state, "creationDate")}
        />
      </div>
      <TextField
        label="URL source"
        name="sourceUrl"
        type="url"
        defaultValue={defaults.sourceUrl ?? ""}
        placeholder="https://… (laisser vide si inconnue)"
        error={fieldError(state, "sourceUrl")}
      />
      <TextAreaField label="Description" name="description" defaultValue={defaults.description ?? ""} rows={3} />
      <TextAreaField label="Notes personnelles" name="notes" defaultValue={defaults.notes ?? ""} rows={3} />
      <FormMessage state={state} />
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}

export function TagEditor({ assetId, tags, suggestions }: { assetId: string; tags: Option[]; suggestions: Option[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof addTagsAction>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        setValue("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag.id}>
              <Badge variant="secondary" className="gap-1 pr-1">
                <Link href={`/library?tag=${tag.id}`} className="hover:underline">
                  {tag.name}
                </Link>
                <button
                  type="button"
                  className="rounded-sm p-0.5 outline-none hover:bg-background/40 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Retirer le tag ${tag.name}`}
                  disabled={pending}
                  onClick={() => run(() => removeTagAction([assetId], tag.id))}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun tag.</p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const names = value.split(",").map((name) => name.trim()).filter(Boolean);
          if (names.length > 0) run(() => addTagsAction([assetId], names));
        }}
      >
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ajouter (séparés par des virgules)"
          aria-label="Ajouter des tags"
          list="asset-tag-suggestions"
          autoComplete="off"
        />
        <datalist id="asset-tag-suggestions">
          {suggestions.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
        <Button type="submit" variant="outline" size="icon" disabled={pending || !value.trim()} aria-label="Ajouter les tags">
          <Plus aria-hidden />
        </Button>
      </form>
    </div>
  );
}

export function CollectionEditor({
  assetId,
  collections,
  allCollections,
}: {
  assetId: string;
  collections: Option[];
  allCollections: Option[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const memberIds = new Set(collections.map((collection) => collection.id));
  const available = allCollections.filter((collection) => !memberIds.has(collection.id));

  function run(action: () => ReturnType<typeof addToCollectionAction>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        setSelected("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {collections.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Collections">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Badge variant="outline" className="gap-1 pr-1">
                <Link href={`/collections/${collection.id}`} className="hover:underline">
                  {collection.name}
                </Link>
                <button
                  type="button"
                  className="rounded-sm p-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Retirer de la collection ${collection.name}`}
                  disabled={pending}
                  onClick={() => run(() => removeFromCollectionAction([assetId], collection.id))}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Dans aucune collection.</p>
      )}
      {available.length > 0 ? (
        <div className="flex gap-2">
          <NativeSelect value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Collection à ajouter">
            <option value="">Ajouter à une collection…</option>
            {available.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </NativeSelect>
          <Button
            variant="outline"
            size="icon"
            disabled={pending || !selected}
            onClick={() => run(() => addToCollectionAction([assetId], selected))}
            aria-label="Ajouter à la collection"
          >
            <Plus aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DeleteAssetButton({ assetId, title, usageSummary }: { assetId: string; title: string; usageSummary: string[] }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 aria-hidden />
          Supprimer
        </Button>
      }
      title={`Supprimer « ${title} » ?`}
      description={
        <>
          <p>L&apos;original, la miniature et l&apos;aperçu seront définitivement supprimés.</p>
          {usageSummary.length > 0 ? (
            <>
              <p>Ces liens seront aussi retirés :</p>
              <ul className="list-disc pl-5">
                {usageSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      }
      action={() => deleteAssetsAction([assetId])}
      onDone={() => router.push("/library")}
    />
  );
}

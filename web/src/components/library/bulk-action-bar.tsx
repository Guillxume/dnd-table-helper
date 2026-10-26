"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { Columns3, FolderPlus, Shapes, Star, StarOff, Tags, Trash2, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addTagsAction,
  addToCollectionAction,
  createCollectionWithAssetsAction,
  deleteAssetsAction,
  getDeletionImpactAction,
  removeFromCollectionAction,
  removeTagAction,
  setCategoryAction,
  setCollectionCoverAction,
  setFavoriteAction,
} from "@/app/(app)/library/actions";
import { NativeSelect } from "@/components/shared/form-controls";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ActionResult } from "@/lib/action-result";
import { pluralize } from "@/lib/text";
import type { LibraryOptions } from "./library-filter-bar";

type DialogKind = "tags" | "collection" | "category" | "delete" | null;

export type SelectionChange = { removed?: string[]; favorite?: boolean };

export function BulkActionBar({
  selectedIds,
  options,
  currentCollectionId,
  onClear,
  onSelectAll,
  onChanged,
  allSelected,
}: {
  selectedIds: string[];
  options: LibraryOptions;
  currentCollectionId?: string;
  onClear: () => void;
  onSelectAll: () => void;
  onChanged: (change?: SelectionChange) => void;
  allSelected: boolean;
}) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, startTransition] = useTransition();
  const count = selectedIds.length;

  function run(action: () => Promise<ActionResult<unknown>>, change?: SelectionChange) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      setDialog(null);
      onChanged(change);
    });
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Actions sur la sélection"
        className="sticky bottom-3 z-20 mx-auto mt-6 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border bg-popover/95 p-1.5 shadow-lg backdrop-blur"
      >
        <span className="px-2 text-sm font-medium" aria-live="polite">
          {pluralize(count, "sélectionnée", "sélectionnées")}
        </span>
        {!allSelected ? (
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Tout sélectionner
          </Button>
        ) : null}
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setFavoriteAction(selectedIds, true), { favorite: true })}>
          <Star aria-hidden />
          Favori
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setFavoriteAction(selectedIds, false), { favorite: false })}>
          <StarOff aria-hidden />
          Retirer favori
        </Button>
        {count >= 2 && count <= 4 ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/library/compare?ids=${selectedIds.join(",")}`}>
              <Columns3 aria-hidden />
              Comparer
            </Link>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => setDialog("tags")}>
          <Tags aria-hidden />
          Tags
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDialog("collection")}>
          <FolderPlus aria-hidden />
          Collection
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDialog("category")}>
          <Shapes aria-hidden />
          Catégorie
        </Button>
        {currentCollectionId && count === 1 ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => setCollectionCoverAction(currentCollectionId, selectedIds[0]))}
          >
            Définir comme couverture
          </Button>
        ) : null}
        {currentCollectionId ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => removeFromCollectionAction(selectedIds, currentCollectionId), { removed: selectedIds })
            }
          >
            Retirer de la collection
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDialog("delete")}>
          <Trash2 aria-hidden />
          Supprimer
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Annuler la sélection">
          <X aria-hidden />
        </Button>
        {pending ? <D20Loader className="mx-1 size-4" label="Traitement…" /> : null}
      </div>

      <TagsDialog
        open={dialog === "tags"}
        onClose={() => setDialog(null)}
        count={count}
        tags={options.tags}
        pending={pending}
        onAdd={(names) => run(() => addTagsAction(selectedIds, names))}
        onRemove={(tagId) => run(() => removeTagAction(selectedIds, tagId))}
      />
      <CollectionDialog
        open={dialog === "collection"}
        onClose={() => setDialog(null)}
        count={count}
        collections={options.collections}
        pending={pending}
        onAdd={(collectionId) => run(() => addToCollectionAction(selectedIds, collectionId))}
        onRemove={(collectionId) => run(() => removeFromCollectionAction(selectedIds, collectionId))}
        onCreate={(name) => run(() => createCollectionWithAssetsAction(name, selectedIds))}
      />
      <SimpleDialog
        open={dialog === "category"}
        onClose={() => setDialog(null)}
        title="Changer la catégorie"
        description={`S'applique à ${pluralize(count, "illustration")}.`}
      >
        <CategoryForm
          categories={options.categories}
          pending={pending}
          onApply={(categoryId) => run(() => setCategoryAction(selectedIds, categoryId))}
        />
      </SimpleDialog>
      <DeleteDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        ids={selectedIds}
        onDeleted={() => onChanged({ removed: selectedIds })}
      />
    </>
  );
}

function SimpleDialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function TagsDialog({
  open,
  onClose,
  count,
  tags,
  pending,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  tags: LibraryOptions["tags"];
  pending: boolean;
  onAdd: (names: string[]) => void;
  onRemove: (tagId: string) => void;
}) {
  const [names, setNames] = useState("");
  const [removeId, setRemoveId] = useState("");
  return (
    <SimpleDialog open={open} onClose={onClose} title="Tags" description={`S'applique à ${pluralize(count, "illustration")}.`}>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const list = names.split(",").map((name) => name.trim()).filter(Boolean);
          if (list.length > 0) onAdd(list);
        }}
      >
        <Label htmlFor="bulk-tags">Ajouter des tags (séparés par des virgules)</Label>
        <Input
          id="bulk-tags"
          value={names}
          onChange={(event) => setNames(event.target.value)}
          placeholder="clerc, lumière divine, armure"
          list="bulk-tags-suggestions"
          autoComplete="off"
        />
        <datalist id="bulk-tags-suggestions">
          {tags.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
        <Button type="submit" disabled={pending || !names.trim()}>
          Ajouter
        </Button>
      </form>
      {tags.length > 0 ? (
        <>
          <Separator />
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (removeId) onRemove(removeId);
            }}
          >
            <Label htmlFor="bulk-remove-tag">Retirer un tag</Label>
            <NativeSelect id="bulk-remove-tag" value={removeId} onChange={(event) => setRemoveId(event.target.value)}>
              <option value="">Choisir un tag…</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="outline" disabled={pending || !removeId}>
              Retirer
            </Button>
          </form>
        </>
      ) : null}
    </SimpleDialog>
  );
}

function CollectionDialog({
  open,
  onClose,
  count,
  collections,
  pending,
  onAdd,
  onRemove,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  collections: LibraryOptions["collections"];
  pending: boolean;
  onAdd: (collectionId: string) => void;
  onRemove: (collectionId: string) => void;
  onCreate: (name: string) => void;
}) {
  const [collectionId, setCollectionId] = useState("");
  const [name, setName] = useState("");
  return (
    <SimpleDialog
      open={open}
      onClose={onClose}
      title="Collections"
      description={`S'applique à ${pluralize(count, "illustration")}. Une illustration peut appartenir à plusieurs collections.`}
    >
      {collections.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="bulk-collection">Collection existante</Label>
          <NativeSelect id="bulk-collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
            <option value="">Choisir une collection…</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </NativeSelect>
          <div className="flex gap-2">
            <Button disabled={pending || !collectionId} onClick={() => onAdd(collectionId)}>
              Ajouter
            </Button>
            <Button variant="outline" disabled={pending || !collectionId} onClick={() => onRemove(collectionId)}>
              Retirer
            </Button>
          </div>
        </div>
      ) : null}
      <Separator />
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onCreate(name.trim());
        }}
      >
        <Label htmlFor="bulk-new-collection">Nouvelle collection</Label>
        <Input
          id="bulk-new-collection"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Références pour Elamaer"
        />
        <Button type="submit" variant="outline" disabled={pending || !name.trim()}>
          Créer et ajouter
        </Button>
      </form>
    </SimpleDialog>
  );
}

function CategoryForm({
  categories,
  pending,
  onApply,
}: {
  categories: LibraryOptions["categories"];
  pending: boolean;
  onApply: (categoryId: string | null) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(value || null);
      }}
    >
      <Label htmlFor="bulk-category">Catégorie</Label>
      <NativeSelect id="bulk-category" value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="">Sans catégorie</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </NativeSelect>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          Appliquer
        </Button>
      </DialogFooter>
    </form>
  );
}

type Usage = Extract<Awaited<ReturnType<typeof getDeletionImpactAction>>, { ok: true }>["data"];

function DeleteDialog({
  open,
  onClose,
  ids,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  ids: string[];
  onDeleted: () => void;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [pending, startTransition] = useTransition();

  // Charge l'impact à l'ouverture pour l'afficher dans la confirmation.
  const key = ids.join(",");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getDeletionImpactAction(key.split(",")).then((result) => {
      if (!cancelled && result.ok && result.data) setUsage(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, key]);

  function close() {
    setUsage(null);
    onClose();
  }

  const usageLines = usage
    ? [
        usage.collections && `${pluralize(usage.collections, "rattachement")} à des collections`,
        usage.characters && `${pluralize(usage.characters, "référence")} de personnage`,
        usage.styleGuides && `${pluralize(usage.styleGuides, "référence")} de guide artistique`,
        usage.briefs && `${pluralize(usage.briefs, "référence")} de brief`,
        usage.generationReferences && `${pluralize(usage.generationReferences, "référence")} de génération archivée`,
        usage.generationResults && `${pluralize(usage.generationResults, "génération")} perdra son image`,
        usage.battleMaps && `${pluralize(usage.battleMaps, "carte de bataille supprimée", "cartes de bataille supprimées")}`,
      ].filter(Boolean)
    : [];

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {pluralize(ids.length, "illustration")} ?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>Les fichiers originaux, miniatures et aperçus seront définitivement supprimés.</p>
              {usage === null ? (
                <p>Vérification des usages…</p>
              ) : usageLines.length > 0 ? (
                <>
                  <p>Ces liens seront également retirés :</p>
                  <ul className="list-disc pl-5">
                    {usageLines.map((line) => (
                      <li key={String(line)}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Aucune autre donnée n&apos;utilise ces illustrations.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteAssetsAction(ids);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(result.message ?? "Supprimé.");
                close();
                onDeleted();
              })
            }
          >
            {pending ? <D20Loader /> : null}
            Supprimer définitivement
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

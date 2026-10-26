"use client";

import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  addAssetsToCollectionAction,
  createCollectionAction,
  deleteCollectionAction,
  markCollectionViewedAction,
  updateCollectionAction,
} from "@/app/(app)/collections/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { fieldError, FormMessage, SubmitButton, TextAreaField, TextField, useFormAction } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AssetPicker } from "./asset-picker";

export function NewCollectionDialog() {
  const [state, formAction] = useFormAction(createCollectionAction);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <FolderPlus aria-hidden />
          Nouvelle collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle collection</DialogTitle>
          <DialogDescription>Regroupez des références autour d&apos;un objectif, d&apos;un personnage ou d&apos;un projet.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <TextField label="Nom" name="name" required maxLength={120} placeholder="Références pour Rek'tal" error={fieldError(state, "name")} />
          <TextAreaField label="Objectif (facultatif)" name="description" rows={3} />
          <FormMessage state={state} />
          <SubmitButton>Créer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditCollectionDialog({ id, name, description }: { id: string; name: string; description: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormAction(updateCollectionAction.bind(null, id), { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil aria-hidden />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la collection</DialogTitle>
          <DialogDescription>Le nom est aussi utilisé par la recherche.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <TextField label="Nom" name="name" defaultValue={name} required maxLength={120} error={fieldError(state, "name")} />
          <TextAreaField label="Objectif" name="description" defaultValue={description ?? ""} rows={3} />
          <FormMessage state={state} />
          <SubmitButton>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCollectionButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive">
          <Trash2 aria-hidden />
          Supprimer
        </Button>
      }
      title={`Supprimer la collection « ${name} » ?`}
      description={<p>Seul le regroupement est supprimé : les illustrations restent dans la bibliothèque.</p>}
      action={() => deleteCollectionAction(id)}
      onDone={() => router.push("/collections")}
    />
  );
}

export function AddToCollectionPicker({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  return (
    <AssetPicker
      title="Ajouter à la collection"
      onConfirm={async (assets) => {
        const result = await addAssetsToCollectionAction(collectionId, assets.map((asset) => asset.id));
        if (result.ok) {
          toast.success(result.message ?? "Ajouté.");
          router.refresh();
        } else toast.error(result.error);
      }}
    />
  );
}

/** Enregistre la consultation après affichage (et non pendant le rendu serveur). */
export function MarkCollectionViewed({ id }: { id: string }) {
  useEffect(() => {
    void markCollectionViewedAction(id);
  }, [id]);
  return null;
}

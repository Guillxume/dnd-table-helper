"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { fieldError, FormMessage, SubmitButton, TextField, useFormAction } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/text";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "./actions";

export function NewCategoryForm({ nextOrder }: { nextOrder: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormAction(createCategoryAction, { onSuccess: () => formRef.current?.reset() });
  return (
    <form ref={formRef} action={formAction} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
      <TextField label="Nouvelle catégorie" name="name" required maxLength={80} error={fieldError(state, "name")} />
      <TextField label="Ordre" name="sortOrder" type="number" min={0} defaultValue={nextOrder} />
      <input type="hidden" name="description" value="" />
      <SubmitButton>
        <Plus aria-hidden />
        Ajouter
      </SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CategoryRow({
  category,
}: {
  category: { id: string; name: string; description: string | null; sortOrder: number; count: number };
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormAction(updateCategoryAction.bind(null, category.id), {
    onSuccess: () => setEditing(false),
  });

  if (editing) {
    return (
      <li className="px-3 py-3">
        <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <TextField label="Nom" name="name" defaultValue={category.name} required maxLength={80} error={fieldError(state, "name")} />
          <TextField label="Ordre" name="sortOrder" type="number" min={0} defaultValue={category.sortOrder} />
          <TextField label="Description" name="description" defaultValue={category.description ?? ""} className="sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <SubmitButton size="sm">Enregistrer</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
          <div className="sm:col-span-2">
            <FormMessage state={state} />
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="w-10 text-xs text-muted-foreground tabular-nums">{category.sortOrder}</span>
      <div className="min-w-0 flex-1">
        <Link href={`/library?category=${category.id}`} className="font-medium hover:underline">
          {category.name}
        </Link>
        {category.description ? <p className="truncate text-xs text-muted-foreground">{category.description}</p> : null}
      </div>
      <span className="text-xs text-muted-foreground">{pluralize(category.count, "illustration")}</span>
      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Modifier ${category.name}`}>
        <Pencil aria-hidden />
      </Button>
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${category.name}`}>
            <Trash2 aria-hidden />
          </Button>
        }
        title={`Supprimer la catégorie « ${category.name} » ?`}
        description={<p>{pluralize(category.count, "illustration")} deviendra « sans catégorie ». Aucune image n&apos;est supprimée.</p>}
        action={() => deleteCategoryAction(category.id)}
      />
    </li>
  );
}

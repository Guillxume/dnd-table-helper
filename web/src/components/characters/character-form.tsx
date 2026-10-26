"use client";

import Link from "next/link";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField, fieldError, useFormAction } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { CharacterKind } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { CANONICAL_FIELD_LABELS, type CanonicalFieldKey } from "@/lib/brief/build-brief";
import { CHARACTER_KIND_LABELS } from "@/lib/labels";

type Defaults = Partial<Record<CanonicalFieldKey | "name" | "summary", string | null>> & { kind?: CharacterKind };

const GROUPS: { title: string; fields: { key: CanonicalFieldKey; rows: number; placeholder?: string }[] }[] = [
  {
    title: "Identité",
    fields: [
      { key: "species", rows: 1 },
      { key: "characterClass", rows: 1 },
      { key: "specialization", rows: 1 },
    ],
  },
  {
    title: "Apparence canonique",
    fields: [
      { key: "silhouette", rows: 3, placeholder: "Taille, carrure, posture…" },
      { key: "face", rows: 3, placeholder: "Forme du visage, yeux, cicatrices, marques…" },
      { key: "hairSkin", rows: 3 },
    ],
  },
  {
    title: "Tenue et attributs",
    fields: [
      { key: "outfit", rows: 3 },
      { key: "equipment", rows: 3 },
      { key: "palette", rows: 2, placeholder: "Couleurs dominantes et d'accent" },
      { key: "symbols", rows: 2 },
    ],
  },
  {
    title: "Contexte",
    fields: [
      { key: "personality", rows: 3 },
      { key: "visualHistory", rows: 3, placeholder: "Ce qui, dans son histoire, se voit : blessures, héritage, appartenances…" },
      { key: "notes", rows: 3 },
    ],
  },
];

export function CharacterForm({
  action,
  defaults = {},
  cancelHref,
  submitLabel,
}: {
  action: (previous: unknown, form: FormData) => Promise<ActionResult>;
  defaults?: Defaults;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useFormAction(action);
  return (
    <form action={formAction} className="max-w-4xl space-y-8">
      <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        Ces champs décrivent des <strong className="text-foreground">faits canoniques confirmés</strong>. Laissez vide ce qui
        n&apos;est pas établi : un champ vide reste « inconnu » et n&apos;est jamais complété automatiquement. Les préférences,
        hypothèses et exclusions se gèrent dans la fiche, section « Éléments typés ».
      </p>
      <fieldset className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <legend className="mb-3 font-heading text-lg font-semibold">Personnage</legend>
        <TextField label="Nom" name="name" defaultValue={defaults.name ?? ""} required maxLength={120} error={fieldError(state, "name")} />
        <SelectField label="Type" name="kind" defaultValue={defaults.kind ?? "PLAYER_CHARACTER"}>
          {Object.values(CharacterKind).map((kind) => (
            <option key={kind} value={kind}>
              {CHARACTER_KIND_LABELS[kind]}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Résumé"
          name="summary"
          defaultValue={defaults.summary ?? ""}
          rows={2}
          className="sm:col-span-2"
          hint="Une ou deux phrases qui situent le personnage."
        />
      </fieldset>
      {GROUPS.map((group) => (
        <fieldset key={group.title} className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-heading text-lg font-semibold">{group.title}</legend>
          {group.fields.map((field) =>
            field.rows === 1 ? (
              <TextField
                key={field.key}
                label={CANONICAL_FIELD_LABELS[field.key]}
                name={field.key}
                defaultValue={defaults[field.key] ?? ""}
                placeholder="Inconnu"
              />
            ) : (
              <TextAreaField
                key={field.key}
                label={CANONICAL_FIELD_LABELS[field.key]}
                name={field.key}
                defaultValue={defaults[field.key] ?? ""}
                rows={field.rows}
                placeholder={field.placeholder ?? "Inconnu"}
              />
            ),
          )}
        </fieldset>
      ))}
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}

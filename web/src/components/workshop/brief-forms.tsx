"use client";

import { FileJson, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBriefAction, updateBriefTextAction } from "@/app/(app)/workshop/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { CopyButton } from "@/components/shared/copy-button";
import {
  fieldError,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  useFormAction,
} from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubjectType } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { BRIEF_SECTION_KEYS, BRIEF_SECTION_TITLES, type BriefSections, briefToText } from "@/lib/brief/build-brief";
import { CHARACTER_KIND_LABELS, SUBJECT_TYPE_LABELS } from "@/lib/labels";
import { type EditableReference, ReferenceListEditor, serializeReferences } from "./reference-list-editor";

const IMAGE_TYPE_SUGGESTIONS = [
  "Portrait en buste",
  "Personnage en pied",
  "Fiche de personnage illustrée",
  "Scène d'action",
  "Créature en vue complète",
  "Planche d'objet",
  "Paysage / environnement",
  "Vue d'architecture",
  "Carte de bataille vue de dessus",
  "Plan de donjon",
];

const ASPECT_RATIO_SUGGESTIONS = ["1:1 (carré)", "2:3 (portrait)", "3:2 (paysage)", "4:5 (portrait)", "16:9 (panoramique)", "9:16 (vertical)"];

export type BriefFormDefaults = {
  title?: string;
  subjectType?: SubjectType;
  characterId?: string | null;
  styleGuideId?: string | null;
  objective?: string;
  imageType?: string;
  subjectDetails?: string | null;
  framing?: string | null;
  aspectRatio?: string | null;
  highlights?: string | null;
  constraints?: string | null;
  exclusions?: string | null;
  references?: EditableReference[];
};

export function BriefParamsForm({
  action,
  defaults,
  characters,
  guides,
  submitLabel,
  cancelHref,
  regenerateWarning = false,
}: {
  action: (previous: unknown, form: FormData) => Promise<ActionResult>;
  defaults: BriefFormDefaults;
  characters: { id: string; name: string; kind: keyof typeof CHARACTER_KIND_LABELS }[];
  guides: { id: string; label: string }[];
  submitLabel: string;
  cancelHref: string;
  regenerateWarning?: boolean;
}) {
  const [state, formAction] = useFormAction(action);
  const [references, setReferences] = useState<EditableReference[]>(defaults.references ?? []);
  const [subjectType, setSubjectType] = useState<SubjectType>(defaults.subjectType ?? "CHARACTER");

  return (
    <form action={formAction} className="max-w-4xl space-y-8">
      <input type="hidden" name="references" value={serializeReferences(references)} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-heading text-lg font-semibold">Sujet</legend>
        <TextField
          label="Titre du brief"
          name="title"
          defaultValue={defaults.title}
          required
          maxLength={200}
          className="sm:col-span-2"
          placeholder="Portrait de Rek'tal, lumière divine"
          error={fieldError(state, "title")}
        />
        <SelectField
          label="Type de sujet"
          name="subjectType"
          value={subjectType}
          onChange={(event) => setSubjectType(event.target.value as SubjectType)}
        >
          {Object.values(SubjectType).map((type) => (
            <option key={type} value={type}>
              {SUBJECT_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Fiche canonique"
          name="characterId"
          defaultValue={defaults.characterId ?? ""}
          hint="Sa description canonique, ses éléments intangibles et ses exclusions alimentent le brief."
        >
          <option value="">Aucune</option>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name} ({CHARACTER_KIND_LABELS[character.kind]})
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Objectif de l'image"
          name="objective"
          defaultValue={defaults.objective}
          required
          rows={2}
          className="sm:col-span-2"
          placeholder="Portrait de référence pour la fiche du personnage, à réutiliser comme base de cohérence."
          error={fieldError(state, "objective")}
        />
        <TextAreaField
          label="Précisions sur le sujet pour cette image"
          name="subjectDetails"
          defaultValue={defaults.subjectDetails ?? ""}
          rows={2}
          className="sm:col-span-2"
          hint={subjectType === "CHARACTER" || subjectType === "NPC" ? "Pose, expression, situation…" : "Description du sujet (objet, lieu, créature…)."}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-heading text-lg font-semibold">Image</legend>
        <TextField
          label="Type d'image"
          name="imageType"
          defaultValue={defaults.imageType}
          required
          list="image-type-suggestions"
          maxLength={200}
          error={fieldError(state, "imageType")}
        />
        <datalist id="image-type-suggestions">
          {IMAGE_TYPE_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <TextField label="Format" name="aspectRatio" defaultValue={defaults.aspectRatio ?? ""} list="ratio-suggestions" maxLength={50} />
        <datalist id="ratio-suggestions">
          {ASPECT_RATIO_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <SelectField label="Guide artistique" name="styleGuideId" defaultValue={defaults.styleGuideId ?? ""} hint="La dernière version du guide est utilisée.">
          <option value="">Aucun</option>
          {guides.map((guide) => (
            <option key={guide.id} value={guide.id}>
              {guide.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Cadrage" name="framing" defaultValue={defaults.framing ?? ""} maxLength={2000} placeholder="Plan rapproché, légère contre-plongée…" />
        <TextAreaField label="Éléments à mettre en avant" name="highlights" defaultValue={defaults.highlights ?? ""} rows={2} />
        <TextAreaField label="Contraintes" name="constraints" defaultValue={defaults.constraints ?? ""} rows={2} />
        <TextAreaField
          label="Exclusions"
          name="exclusions"
          defaultValue={defaults.exclusions ?? ""}
          rows={2}
          className="sm:col-span-2"
          hint="S'ajoutent aux exclusions de la fiche et aux « éléments à éviter » du guide."
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-3 font-heading text-lg font-semibold">Références visuelles</legend>
        <ReferenceListEditor value={references} onChange={setReferences} />
      </fieldset>

      {regenerateWarning ? (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          Enregistrer régénère les dix sections et le prompt : les retouches manuelles du texte seront remplacées.
        </p>
      ) : null}
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

/** Édition libre du brief généré : chaque section et le prompt restent modifiables. */
export function BriefTextEditor({
  briefId,
  title,
  sections,
  prompt,
}: {
  briefId: string;
  title: string;
  sections: BriefSections;
  prompt: string;
}) {
  const [values, setValues] = useState({ ...sections, prompt });
  const [dirty, setDirty] = useState(false);
  const [state, formAction] = useFormAction(updateBriefTextAction.bind(null, briefId), { onSuccess: () => setDirty(false) });

  function set(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  return (
    <form action={formAction} className="space-y-6">
      <section aria-labelledby="prompt-title" className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="prompt-title" className="font-heading text-lg font-semibold">
            Prompt pour ChatGPT Images
          </h2>
          <CopyButton getText={() => values.prompt} label="Copier le prompt" variant="default" successMessage="Prompt copié." />
        </div>
        <Label htmlFor="brief-prompt" className="sr-only">
          Prompt
        </Label>
        <Textarea
          id="brief-prompt"
          name="prompt"
          value={values.prompt}
          onChange={(event) => set("prompt", event.target.value)}
          rows={10}
          className="font-mono text-[0.8rem] leading-relaxed"
        />
        <FieldErrorText state={state} name="prompt" />
      </section>

      <section aria-labelledby="brief-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="brief-title" className="font-heading text-lg font-semibold">
            Brief complet
          </h2>
          <div className="flex gap-2">
            <CopyButton
              getText={() => briefToText(title, values)}
              label="Copier le brief"
              successMessage="Brief copié."
            />
            <Button asChild variant="outline" size="sm">
              <a href={`/api/briefs/${briefId}/export`} download>
                <FileJson aria-hidden />
                Export JSON
              </a>
            </Button>
          </div>
        </div>
        {BRIEF_SECTION_KEYS.map((key) => (
          <div key={key}>
            <Label htmlFor={`section-${key}`} className="mb-1.5">
              {BRIEF_SECTION_TITLES[key]}
            </Label>
            <Textarea
              id={`section-${key}`}
              name={key}
              value={values[key]}
              onChange={(event) => set(key, event.target.value)}
              rows={Math.min(14, Math.max(3, values[key].split("\n").length + 1))}
            />
          </div>
        ))}
      </section>

      <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-xl border bg-popover/95 p-2 backdrop-blur">
        <SubmitButton disabled={!dirty}>
          <Save aria-hidden />
          Enregistrer le texte
        </SubmitButton>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? "Modifications non enregistrées." : "Texte enregistré."}
        </span>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function FieldErrorText({ state, name }: { state: Parameters<typeof fieldError>[0]; name: string }) {
  const error = fieldError(state, name);
  return error ? <p className="text-xs text-destructive">{error}</p> : null;
}

export function DeleteBriefButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive">
          <Trash2 aria-hidden />
          Supprimer
        </Button>
      }
      title={`Supprimer le brief « ${title} » ?`}
      description={<p>Les générations archivées à partir de ce brief conservent leur copie du texte et du prompt.</p>}
      action={() => deleteBriefAction(id)}
      onDone={() => router.push("/workshop")}
    />
  );
}

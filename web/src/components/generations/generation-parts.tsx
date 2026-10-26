"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { BadgeCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  attachGenerationImageAction,
  createGenerationAction,
  deleteGenerationAction,
  promoteGenerationAction,
  setGenerationStatusAction,
  updateGenerationAction,
} from "@/app/(app)/generations/actions";
import { Dropzone } from "@/components/library/dropzone";
import { AssetImage } from "@/components/shared/asset-image";
import { ConfirmAction } from "@/components/shared/confirm-action";
import {
  fieldError,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  useFormAction,
} from "@/components/shared/form-controls";
import { type EditableReference, ReferenceListEditor, serializeReferences } from "@/components/workshop/reference-list-editor";
import { Button } from "@/components/ui/button";
import { GenerationStatus } from "@/generated/prisma/enums";
import { GENERATION_STATUS_LABELS } from "@/lib/labels";
import { uploadAsset } from "@/lib/upload-client";
import { formatBytes } from "@/lib/upload-rules";
import { cn } from "@/lib/utils";

type UploadedImage = { id: string; title: string; width?: number; height?: number };

/** Import d'une seule image générée (origine « Génération IA »), avec progression. */
function GeneratedImageUpload({
  value,
  onChange,
  maxBytes,
}: {
  value: UploadedImage | null;
  onChange: (image: UploadedImage | null) => void;
  maxBytes: number;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > maxBytes) {
      setError(`Fichier trop volumineux (maximum ${formatBytes(maxBytes)}).`);
      return;
    }
    setProgress(0);
    const result = await uploadAsset(file, { origin: "GENERATED" }, setProgress);
    setProgress(null);
    if (result.status === "created") onChange(result.asset);
    else if (result.status === "duplicate") {
      onChange(result.asset);
      toast.info("Cette image était déjà dans la bibliothèque : elle sera utilisée telle quelle.");
    } else setError(result.reason);
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border p-3">
        <div className="w-24 overflow-hidden rounded-md bg-muted">
          <AssetImage assetId={value.id} alt={value.title} width={value.width ?? 640} height={value.height ?? 640} />
        </div>
        <p className="min-w-0 flex-1 truncate text-sm">{value.title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <X aria-hidden />
          Changer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Dropzone
        multiple={false}
        disabled={progress !== null}
        onFiles={(files) => files[0] && void upload(files[0])}
        hint="L'image obtenue dans ChatGPT (ou un autre outil), téléchargée sur votre ordinateur."
      />
      {progress !== null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <D20Loader className="size-4" />
          {progress < 1 ? `Envoi… ${Math.round(progress * 100)} %` : "Traitement…"}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type GenerationFormDefaults = {
  title: string;
  briefId: string | null;
  briefTitle: string | null;
  characterId: string | null;
  styleGuideVersionId: string | null;
  styleGuideLabel: string | null;
  previousId: string | null;
  previousTitle: string | null;
  prompt: string;
  references: EditableReference[];
};

export function GenerationForm({
  defaults,
  characters,
  maxBytes,
}: {
  defaults: GenerationFormDefaults;
  characters: { id: string; name: string }[];
  maxBytes: number;
}) {
  const [state, formAction] = useFormAction(createGenerationAction);
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [references, setReferences] = useState(defaults.references);

  return (
    <form action={formAction} className="max-w-4xl space-y-8">
      <input type="hidden" name="assetId" value={image?.id ?? ""} />
      <input type="hidden" name="briefId" value={defaults.briefId ?? ""} />
      <input type="hidden" name="styleGuideVersionId" value={defaults.styleGuideVersionId ?? ""} />
      <input type="hidden" name="previousId" value={defaults.previousId ?? ""} />
      <input type="hidden" name="references" value={serializeReferences(references)} />

      {defaults.briefTitle || defaults.previousTitle || defaults.styleGuideLabel ? (
        <ul className="space-y-1 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          {defaults.briefTitle ? (
            <li>
              Brief d&apos;origine : <span className="text-foreground">{defaults.briefTitle}</span> (une copie du brief est archivée)
            </li>
          ) : null}
          {defaults.styleGuideLabel ? (
            <li>
              Guide utilisé : <span className="text-foreground">{defaults.styleGuideLabel}</span>
            </li>
          ) : null}
          {defaults.previousTitle ? (
            <li>
              Nouvelle version de : <span className="text-foreground">{defaults.previousTitle}</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="mb-3 font-heading text-lg font-semibold">Image obtenue</legend>
        <GeneratedImageUpload value={image} onChange={setImage} maxBytes={maxBytes} />
        <p className="text-xs text-muted-foreground">
          Facultatif pour un brouillon : l&apos;image peut être rattachée plus tard. Aucune récupération automatique depuis
          ChatGPT n&apos;est possible ; l&apos;import est manuel.
        </p>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-heading text-lg font-semibold">Archive</legend>
        <TextField label="Titre" name="title" defaultValue={defaults.title} required maxLength={200} className="sm:col-span-2" error={fieldError(state, "title")} />
        <SelectField label="Statut" name="status" defaultValue="TO_REVIEW">
          {Object.values(GenerationStatus).map((status) => (
            <option key={status} value={status}>
              {GENERATION_STATUS_LABELS[status]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Personnage" name="characterId" defaultValue={defaults.characterId ?? ""}>
          <option value="">Aucun</option>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Outil" name="tool" defaultValue="ChatGPT Images" maxLength={120} />
        <TextField
          label="Lien vers la génération d'origine"
          name="sourceUrl"
          type="url"
          placeholder="https://chatgpt.com/… (facultatif)"
          error={fieldError(state, "sourceUrl")}
        />
        <TextAreaField
          label="Prompt utilisé"
          name="prompt"
          defaultValue={defaults.prompt}
          required
          rows={8}
          className="font-mono sm:col-span-2"
          hint="Collez le prompt exact envoyé, y compris vos ajustements de dernière minute."
          error={fieldError(state, "prompt")}
        />
        <TextAreaField label="Notes de révision" name="revisionNotes" rows={3} className="sm:col-span-2" placeholder="Ce qui va, ce qui ne va pas, quoi corriger à la prochaine version." />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-3 font-heading text-lg font-semibold">Références utilisées</legend>
        <ReferenceListEditor value={references} onChange={setReferences} max={20} />
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton>Archiver la génération</SubmitButton>
    </form>
  );
}

export function StatusSwitcher({ id, status }: { id: string; status: GenerationStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Statut">
      {Object.values(GenerationStatus).map((value) => (
        <Button
          key={value}
          size="sm"
          variant={value === status ? "secondary" : "ghost"}
          aria-pressed={value === status}
          disabled={pending}
          className={cn(value === status && value === "VALIDATED" && "text-success", value === status && value === "REJECTED" && "text-destructive")}
          onClick={() =>
            startTransition(async () => {
              const result = await setGenerationStatusAction(id, value);
              if (result.ok) router.refresh();
              else toast.error(result.error);
            })
          }
        >
          {GENERATION_STATUS_LABELS[value]}
        </Button>
      ))}
    </div>
  );
}

/** Génération validée : l'ajouter, en un clic, aux références validées de son personnage. */
export function PromoteToReference({
  id,
  character,
  promoted,
}: {
  id: string;
  character: { id: string; name: string };
  promoted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (promoted) {
    return (
      <p className="rounded-lg border border-success/40 bg-success-bg px-3 py-2 text-sm text-success">
        Référence validée de{" "}
        <Link href={`/characters/${character.id}`} className="underline underline-offset-4">
          {character.name}
        </Link>
        .
      </p>
    );
  }
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await promoteGenerationAction(id);
          if (result.ok) {
            toast.success(result.message ?? "Référence ajoutée.");
            router.refresh();
          } else toast.error(result.error);
        })
      }
    >
      {pending ? <D20Loader /> : <BadgeCheck aria-hidden />}
      Ajouter aux références validées de {character.name}
    </Button>
  );
}

export function GenerationEditForm({
  id,
  defaults,
}: {
  id: string;
  defaults: { title: string; prompt: string; tool: string | null; sourceUrl: string | null; revisionNotes: string | null };
}) {
  const [state, formAction] = useFormAction(updateGenerationAction.bind(null, id));
  return (
    <form action={formAction} className="space-y-3">
      <TextField label="Titre" name="title" defaultValue={defaults.title} required maxLength={200} error={fieldError(state, "title")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Outil" name="tool" defaultValue={defaults.tool ?? ""} maxLength={120} />
        <TextField label="Lien d'origine" name="sourceUrl" type="url" defaultValue={defaults.sourceUrl ?? ""} error={fieldError(state, "sourceUrl")} />
      </div>
      <TextAreaField label="Notes de révision" name="revisionNotes" defaultValue={defaults.revisionNotes ?? ""} rows={4} />
      <TextAreaField label="Prompt utilisé" name="prompt" defaultValue={defaults.prompt} rows={6} className="font-mono" required error={fieldError(state, "prompt")} />
      <FormMessage state={state} />
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}

export function AttachImage({ id, maxBytes }: { id: string; maxBytes: number }) {
  const router = useRouter();
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <GeneratedImageUpload value={image} onChange={setImage} maxBytes={maxBytes} />
      {image ? (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await attachGenerationImageAction(id, image.id);
              if (result.ok) {
                toast.success(result.message ?? "Rattachée.");
                router.refresh();
              } else toast.error(result.error);
            })
          }
        >
          Rattacher cette image
        </Button>
      ) : null}
    </div>
  );
}

export function DeleteGenerationButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive">
          <Trash2 aria-hidden />
          Supprimer l&apos;archive
        </Button>
      }
      title={`Supprimer l'archive « ${title} » ?`}
      description={
        <p>
          Le prompt, la copie du brief et les références associées sont supprimés. L&apos;image reste dans la bibliothèque ; les
          versions suivantes perdent leur lien vers celle-ci.
        </p>
      }
      action={() => deleteGenerationAction(id)}
      onDone={() => router.push("/generations")}
    />
  );
}

export function GenerationLink({ id, title, status }: { id: string; title: string; status: GenerationStatus }) {
  return (
    <Link href={`/generations/${id}`} className="text-primary hover:underline">
      {title} <span className="text-xs text-muted-foreground">({GENERATION_STATUS_LABELS[status].toLowerCase()})</span>
    </Link>
  );
}

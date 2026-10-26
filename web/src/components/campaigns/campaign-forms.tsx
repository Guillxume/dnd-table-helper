"use client";

import { Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelSessionAction,
  clearDeadlineAction,
  deadlineAction,
  discardRecapAction,
  draftRecapAction,
  playerNoteAction,
  prepareAction,
  publishRecapAction,
  removeCarnetAction,
  scheduleSessionAction,
  updateRulesAction,
  updateStyleAction,
} from "@/app/(joueur)/campagnes/actions";
import { D20Loader } from "@/components/brand/d20-loader";
import { RichText } from "@/components/player/rich-text";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { CopyButton } from "@/components/shared/copy-button";
import { FormMessage, SubmitButton, TextAreaField, TextField, useFormAction } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";

// Grands boutons : le texte passe à la ligne sur un petit écran plutôt que de déborder.
const big = "h-auto min-h-12 whitespace-normal px-6 py-2 text-base";

/** Date et heure locales pour les champs date et heure (valeurs par défaut des formulaires). */
function localParts(iso: string | null, timeZone: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "20:30" };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

// ── Prochaine séance ─────────────────────────────────────────────────────────

export function ScheduleSessionForm({ campaignId, current, timezone }: { campaignId: string; current: string | null; timezone: string }) {
  const [state, formAction] = useFormAction(scheduleSessionAction);
  const defaults = localParts(current, timezone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Date" name="date" type="date" required defaultValue={defaults.date} className="[&_input]:h-12" />
        <TextField label="Heure" name="time" type="time" required defaultValue={defaults.time} className="[&_input]:h-12" />
      </div>
      <TextField label="Note pour les joueurs (facultatif)" name="note" maxLength={500} placeholder="Ex : chez Paul, apportez à grignoter" />
      <label className="flex items-center gap-3">
        <input type="checkbox" name="announce" defaultChecked className="size-5 accent-primary" />
        <span>Annoncer la séance sur Discord (avec une mention des joueurs)</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton size="lg" className={big}>
        Enregistrer la séance
      </SubmitButton>
      <p className="text-sm text-muted-foreground">Fuseau horaire : {timezone}. Le bot enverra le rappel 24 h avant.</p>
    </form>
  );
}

export function CancelSessionButton({ campaignId }: { campaignId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" size="lg">
          <X aria-hidden />
          Annuler la séance prévue
        </Button>
      }
      title="Annuler la séance prévue ?"
      description={<p>Aucun rappel ne partira. Pense à prévenir les joueurs sur Discord.</p>}
      confirmLabel="Annuler la séance"
      action={() => cancelSessionAction(campaignId)}
    />
  );
}

// ── Règles, échéance, style ──────────────────────────────────────────────────

export function RulesForm({
  campaignId,
  methods,
  content,
  methodNames,
  contentNames,
}: {
  campaignId: string;
  methods: string[];
  content: string;
  methodNames: Record<string, string>;
  contentNames: Record<string, string>;
}) {
  const [state, formAction] = useFormAction(updateRulesAction);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="campaignId" value={campaignId} />
      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium">Méthodes autorisées pour les caractéristiques</legend>
        {Object.entries(methodNames).map(([id, label]) => (
          <label key={id} className="flex items-start gap-3">
            <input type="checkbox" name="methods" value={id} defaultChecked={methods.includes(id)} className="mt-1 size-5 accent-primary" />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium">Contenu autorisé</legend>
        {Object.entries(contentNames).map(([id, label]) => (
          <label key={id} className="flex items-start gap-3">
            <input type="radio" name="content" value={id} defaultChecked={content === id} className="mt-1 size-5 accent-primary" />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">Niveau de départ : 1 (la montée de niveau se fait à la table).</p>
      <FormMessage state={state} />
      <SubmitButton size="lg" className={big}>
        Enregistrer les règles
      </SubmitButton>
    </form>
  );
}

export function DeadlineForm({ campaignId, deadline, timezone }: { campaignId: string; deadline: string | null; timezone: string }) {
  const [state, formAction] = useFormAction(deadlineAction);
  const defaults = localParts(deadline, timezone);
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Date limite" name="date" type="date" required defaultValue={defaults.date} className="[&_input]:h-12" />
          <TextField label="Heure" name="time" type="time" defaultValue={deadline ? defaults.time : "20:00"} className="[&_input]:h-12" />
        </div>
        <FormMessage state={state} />
        <SubmitButton size="lg" className={big}>
          Enregistrer l&apos;échéance
        </SubmitButton>
      </form>
      {deadline ? (
        <ConfirmAction
          trigger={<Button variant="ghost">Retirer l&apos;échéance</Button>}
          title="Retirer l'échéance ?"
          description={<p>Le bot ne relancera plus les joueurs qui n&apos;ont pas fini leur personnage.</p>}
          confirmLabel="Retirer"
          action={() => clearDeadlineAction(campaignId)}
        />
      ) : null}
    </div>
  );
}

export function StyleForm({
  campaignId,
  style,
  fields,
}: {
  campaignId: string;
  style: Record<string, string | undefined>;
  fields: { id: string; label: string; placeholder: string }[];
}) {
  const [state, formAction] = useFormAction(updateStyleAction);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="campaignId" value={campaignId} />
      {fields.map((field) => (
        <TextAreaField key={field.id} label={field.label} name={field.id} defaultValue={style[field.id] ?? ""} placeholder={field.placeholder} maxLength={600} rows={2} />
      ))}
      <FormMessage state={state} />
      <SubmitButton size="lg" className={big}>
        Enregistrer le guide de style
      </SubmitButton>
    </form>
  );
}

// ── Notes et rappel de séance ────────────────────────────────────────────────

export function PlayerNoteForm({ campaignId, current }: { campaignId: string; current: string | null }) {
  const [state, formAction] = useFormAction(playerNoteAction);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <TextAreaField
        label="Ce dont tu te souviens de la dernière séance"
        name="text"
        defaultValue={current ?? ""}
        maxLength={1500}
        rows={4}
        placeholder="Noms, lieux, indices, ce que ton personnage a fait…"
        hint="Le MJ s'en sert pour écrire le rappel de séance. Une nouvelle note remplace la précédente."
      />
      <FormMessage state={state} />
      <SubmitButton size="lg" className={big}>
        Envoyer ma note
      </SubmitButton>
    </form>
  );
}

export function RecapNotesForm({ campaignId, assistant }: { campaignId: string; assistant: boolean }) {
  const [state, formAction] = useFormAction(draftRecapAction, { toastOnSuccess: false });
  if (!assistant) {
    return <p className="text-muted-foreground">L&apos;assistant n&apos;est pas activé sur ce site : utilise /seance sur Discord.</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <TextAreaField
        label="Tes notes de séance"
        name="notes"
        required
        maxLength={4000}
        rows={10}
        placeholder={"Déroulement : …\nPNJ rencontrés : …\nLieux : …\nObjets : …\nFils ouverts : …"}
        hint="L'assistant rédige un brouillon à partir de tes notes (et de celles des joueurs). Tu le relis avant toute publication."
      />
      <FormMessage state={state} />
      <SubmitButton size="lg" className={big}>
        <Sparkles aria-hidden />
        Rédiger le rappel avec l&apos;assistant
      </SubmitButton>
    </form>
  );
}

export function RecapDraftForm({ campaignId, draft }: { campaignId: string; draft: { id: string; recap: string } }) {
  const router = useRouter();
  const [state, formAction] = useFormAction(publishRecapAction, { toastOnSuccess: false });
  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="campaignId" value={campaignId} />
        <input type="hidden" name="draftId" value={draft.id} />
        <TextAreaField
          label="Brouillon du rappel (modifiable)"
          name="recap"
          defaultValue={draft.recap}
          maxLength={6000}
          rows={16}
          hint="Relis et corrige : c'est ce texte exact qui sera publié sur Discord et ajouté aux rappels de la campagne."
        />
        <FormMessage state={state} />
        <SubmitButton size="lg" className={big}>
          Publier le rappel
        </SubmitButton>
      </form>
      <ConfirmAction
        trigger={<Button variant="ghost">Jeter ce brouillon</Button>}
        title="Jeter ce brouillon ?"
        description={<p>Rien n&apos;a été publié. Tes notes ne sont pas gardées.</p>}
        confirmLabel="Jeter le brouillon"
        action={() => discardRecapAction(campaignId, draft.id)}
        onDone={() => router.replace(`/campagnes/${campaignId}?onglet=seances`)}
      />
    </div>
  );
}

// ── Préparation ──────────────────────────────────────────────────────────────

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export type PrepFormView = { type: string; title: string; fields: { id: string; label: string; placeholder: string; maxLength: number; required: boolean }[] };

export function PrepPanel({ campaignId, forms }: { campaignId: string; forms: PrepFormView[] }) {
  const [type, setType] = useState(forms[0]?.type ?? "scene");
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = forms.find((entry) => entry.type === type) ?? forms[0];
  if (!form) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await prepareAction(campaignId, type, values);
      if (!response.ok) setError(response.error);
      else setResult(response.data?.text ?? null);
    });
  }

  return (
    <div className="space-y-5">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 font-medium">Que veux-tu préparer ?</legend>
        {forms.map((entry) => (
          <Button
            key={entry.type}
            type="button"
            variant={entry.type === type ? "default" : "outline"}
            size="lg"
            aria-pressed={entry.type === type}
            onClick={() => {
              setType(entry.type);
              setResult(null);
            }}
          >
            {capitalize(entry.title.replace(/^Préparer /, ""))}
          </Button>
        ))}
      </fieldset>
      <form onSubmit={submit} className="space-y-4">
        {form.fields.map((field) => (
          <div key={`${form.type}-${field.id}`}>
            <Label htmlFor={`prep-${field.id}`} className="mb-1.5">
              {field.label}
              {field.required ? "" : " (facultatif)"}
            </Label>
            <Textarea
              id={`prep-${field.id}`}
              value={values[field.id] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
              maxLength={field.maxLength}
              required={field.required}
              placeholder={field.placeholder}
              rows={field.maxLength > 400 ? 3 : 2}
            />
          </div>
        ))}
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className={big} disabled={pending}>
          {pending ? <D20Loader /> : <Sparkles aria-hidden />}
          {pending ? "L'assistant prépare… (jusqu'à une minute)" : "Préparer avec l'assistant"}
        </Button>
      </form>
      {result ? (
        <div aria-live="polite" className="space-y-3 rounded-xl border bg-muted/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Brouillon de l&apos;assistant (à relire et adapter)</p>
            <CopyButton text={result} label="Copier le texte" />
          </div>
          <RichText text={result} className="leading-relaxed" />
        </div>
      ) : null}
    </div>
  );
}

// ── Carnet ───────────────────────────────────────────────────────────────────

export function RemoveCarnetButton({ campaignId, kind, name }: { campaignId: string; kind: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Retirer « ${name} » du carnet`}
      title="Retirer du carnet"
      onClick={() =>
        startTransition(async () => {
          const result: ActionResult = await removeCarnetAction(campaignId, kind, name);
          if (result.ok) toast.success(result.message ?? "Retiré.");
          else toast.error(result.error);
          router.refresh();
        })
      }
    >
      {pending ? <D20Loader /> : <Trash2 aria-hidden />}
    </Button>
  );
}

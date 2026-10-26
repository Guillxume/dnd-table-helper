"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { ArrowLeft, Check, ChevronDown, Pencil, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  abandonCreationAction,
  assistantAction,
  finishCreationAction,
  wizardAction,
} from "@/app/(joueur)/personnages/actions";
import { MaybeIcon } from "@/components/icons/maybe-icon";
import { RpgIcon, type RpgIconName } from "@/components/icons/rpg-icons";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { NativeSelect } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import type { ViewOption, WizardView } from "@/server/game/wizard-view";
import { DiceRollReveal } from "./dice-roll-reveal";
import { RichText } from "./rich-text";

type Run = (action: () => Promise<ActionResult<unknown>>, onSuccess?: (result: ActionResult<unknown>) => void) => void;

/** Assistant de création : une seule question à l'écran, toujours la possibilité de revenir en arrière. */
export function WizardScreen({ view, assistant = false }: { view: WizardView; assistant?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Animation du tirage : montrée juste après « Lancer les dés », jusqu'à l'action suivante.
  const [showRoll, setShowRoll] = useState(false);

  const run: Run = (action, onSuccess) => {
    setError(null);
    setShowRoll(false);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.(result);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const step = view.step;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Création de personnage{view.campaignName ? ` · ${view.campaignName}` : ""}
        </p>
        <h1 className="font-heading text-3xl font-semibold">{view.name}</h1>
        {view.summary ? <p className="text-muted-foreground">{view.summary.replaceAll("  ·  ", " · ")}</p> : null}
      </header>

      {view.editing ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
          <p>Tu modifies une étape. Les choix suivants sont gardés tant qu&apos;ils restent possibles.</p>
          <Button variant="outline" disabled={pending} onClick={() => run(() => wizardAction({ type: "cancelEdit" }))}>
            Annuler la modification
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </p>
      ) : null}

      {showRoll && view.diceRolls ? <DiceRollReveal rolls={view.diceRolls} /> : null}

      <section aria-live="polite" className="quest-card p-5 pt-8 sm:p-7 sm:pt-9">
        {step.kind === "select" || step.kind === "multi" ? (
          <ChoiceStep key={step.id} step={step} notes={view.notes} assistant={assistant && step.isSpell} pending={pending} run={run} />
        ) : step.kind === "roll" ? (
          <StepFrame title={step.title} help={step.help}>
            <BigButton pending={pending} onClick={() => run(() => wizardAction({ type: "roll" }), () => setShowRoll(true))}>
              <RpgIcon name="nav-des" className="size-5" />
              Lancer les dés
            </BigButton>
          </StepFrame>
        ) : step.kind === "confirm" ? (
          <StepFrame title={step.title} help={step.help}>
            <BigButton pending={pending} onClick={() => run(() => wizardAction({ type: "answer", stepId: step.id, values: ["ok"] }))}>
              <Check aria-hidden />
              {step.button}
            </BigButton>
          </StepFrame>
        ) : step.kind === "table" ? (
          <TableStep key={step.id} title={step.title} help={step.help} pending={pending} run={run} />
        ) : step.kind === "story" ? (
          <StoryStep key={step.id} title={step.title} help={step.help} assistant={assistant} pending={pending} run={run} />
        ) : step.kind === "name" ? (
          <NameStep stepId={step.id} title={step.title} pending={pending} run={run} />
        ) : (
          <DoneStep step={step} pending={pending} run={run} />
        )}
      </section>

      <nav aria-label="Navigation de la création" className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          disabled={pending || !view.canGoBack}
          onClick={() => run(() => wizardAction({ type: "back" }))}
        >
          <ArrowLeft aria-hidden />
          Étape précédente
        </Button>
        {view.answered.length > 0 ? <EditPicker answered={view.answered} pending={pending} run={run} /> : null}
        <div className="ml-auto">
          <AbandonButton />
        </div>
      </nav>
    </div>
  );
}

function StepFrame({ title, help, icon, children }: { title: string; help?: string; icon?: RpgIconName; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="flex items-center gap-3 font-heading text-2xl font-semibold">
          <MaybeIcon name={icon} className="size-8 text-brass" />
          {title}
        </h2>
        {help ? <RichText text={help} className="text-base leading-relaxed text-muted-foreground" /> : null}
      </div>
      {children}
    </div>
  );
}

function BigButton({
  children,
  pending,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  pending: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <Button type={type} size="lg" className="h-12 w-full px-6 text-base sm:w-auto" disabled={pending || disabled} onClick={onClick}>
      {pending ? <D20Loader /> : null}
      {children}
    </Button>
  );
}

function ChoiceStep({
  step,
  notes,
  assistant,
  pending,
  run,
}: {
  step: Extract<WizardView["step"], { kind: "select" | "multi" }>;
  notes: string[];
  assistant: boolean;
  pending: boolean;
  run: Run;
}) {
  const multiple = step.kind === "multi";
  const [selected, setSelected] = useState<string[]>([]);
  const count = selected.length;
  const valid = multiple ? count >= step.min && count <= step.max : count === 1;
  const target = step.min === step.max ? `${step.max}` : `${step.min} à ${step.max}`;

  function toggle(value: string) {
    setSelected((current) => {
      if (!multiple) return [value];
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= step.max) {
        toast.info(`Tu peux en choisir ${step.max} au maximum. Retire d'abord un choix.`);
        return current;
      }
      return [...current, value];
    });
  }

  return (
    <StepFrame title={step.title} help={step.help} icon={step.icon}>
      {notes.map((note) => (
        <RichText key={note} text={note} className="rounded-lg bg-muted/60 px-4 py-3" />
      ))}
      {assistant ? <AssistantHelp kind="spells" /> : null}
      {multiple ? (
        <p className="font-medium" aria-live="polite">
          {count} choisi{count > 1 ? "s" : ""} sur {target}
        </p>
      ) : null}
      <ul className="grid gap-3" role={multiple ? "group" : "radiogroup"} aria-label={step.title}>
        {step.options.map((option) => (
          <OptionCard
            key={option.value}
            option={option}
            multiple={multiple}
            checked={selected.includes(option.value)}
            onToggle={() => toggle(option.value)}
          />
        ))}
      </ul>
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t bg-card px-5 py-3 sm:-mx-7 sm:px-7">
        <BigButton
          pending={pending}
          disabled={!valid}
          onClick={() => run(() => wizardAction({ type: "answer", stepId: step.id, values: selected }), () => setSelected([]))}
        >
          Continuer
        </BigButton>
        {!valid ? (
          <p className="text-sm text-muted-foreground">
            {multiple ? `Choisis ${target} option${step.max > 1 ? "s" : ""} pour continuer.` : "Choisis une option pour continuer."}
          </p>
        ) : null}
      </div>
    </StepFrame>
  );
}

function OptionCard({
  option,
  multiple,
  checked,
  onToggle,
}: {
  option: ViewOption;
  multiple: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = option.details.trim() !== "" && option.details.trim() !== option.label.trim();
  return (
    <li className={cn("rounded-xl border-2 transition-colors", checked ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")}>
      <button
        type="button"
        role={multiple ? "checkbox" : "radio"}
        aria-checked={checked}
        onClick={onToggle}
        className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center border-2",
            multiple ? "rounded-md" : "rounded-full",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60",
          )}
        >
          {checked ? <Check className="size-4" /> : null}
        </span>
        <MaybeIcon name={option.icon} className={cn("mt-0.5 size-7", checked ? "text-primary" : "text-brass")} />
        <span className="min-w-0">
          <span className="block text-base font-medium">{option.label}</span>
          {option.description ? <span className="block text-sm text-muted-foreground">{option.description}</span> : null}
        </span>
      </button>
      {hasDetails ? (
        <div className={cn("px-4 pb-3", option.icon ? "pl-22" : "pl-13")}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
            {open ? "Masquer les détails" : "En savoir plus"}
          </button>
          {open ? <RichText text={option.details} className="mt-2 text-sm leading-relaxed text-muted-foreground" /> : null}
        </div>
      ) : null}
    </li>
  );
}

function TableStep({ title, help, pending, run }: { title: string; help: string; pending: boolean; run: Run }) {
  const [values, setValues] = useState<string[]>(["", "", "", "", "", ""]);
  const filled = values.every((value) => /^\d{1,2}$/.test(value.trim()));
  return (
    <StepFrame title={title} help={help}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => wizardAction({ type: "answer", stepId: "tableRolls", values: values.map((value) => value.trim()) }));
        }}
      >
        <fieldset>
          <legend className="mb-2 font-medium">Tes six totaux, dans l&apos;ordre des lancers</legend>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {values.map((value, index) => (
              <div key={index}>
                <Label htmlFor={`roll-${index}`} className="mb-1 text-sm text-muted-foreground">
                  Lancer {index + 1}
                </Label>
                <Input
                  id={`roll-${index}`}
                  inputMode="numeric"
                  value={value}
                  maxLength={2}
                  onChange={(event) => setValues((current) => current.map((item, i) => (i === index ? event.target.value : item)))}
                  className="h-12 text-center text-lg"
                />
              </div>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <BigButton type="submit" pending={pending} disabled={!filled}>
            Enregistrer mes résultats
          </BigButton>
          <Button asChild variant="outline" size="lg" className="h-12">
            <a href="/api/personnages/fiche-vide">
              <RpgIcon name="nav-pdf-telecharger" className="size-5" />
              Fiche à cases vides (PDF)
            </a>
          </Button>
        </div>
      </form>
    </StepFrame>
  );
}

function StoryStep({ title, help, assistant, pending, run }: { title: string; help: string; assistant: boolean; pending: boolean; run: Run }) {
  const [story, setStory] = useState({ origin: "", appearance: "", personality: "", backstory: "" });
  const fields: { key: keyof typeof story; label: string; placeholder: string }[] = [
    { key: "origin", label: "Origine (sans effet sur les règles)", placeholder: "Lieu de naissance, milieu, famille…" },
    { key: "appearance", label: "Apparence", placeholder: "Taille, allure, signes distinctifs…" },
    { key: "personality", label: "Personnalité", placeholder: "Traits, idéal, lien, défaut…" },
    { key: "backstory", label: "Histoire du personnage", placeholder: "D'où il vient, ce qui l'a poussé à partir…" },
  ];
  return (
    <StepFrame title={title} help={help}>
      {assistant ? <AssistantHelp kind="ideas" /> : null}
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={`story-${field.key}`} className="mb-1.5 text-base">
              {field.label}
            </Label>
            <Textarea
              id={`story-${field.key}`}
              value={story[field.key]}
              maxLength={1500}
              rows={3}
              placeholder={field.placeholder}
              onChange={(event) => setStory((current) => ({ ...current, [field.key]: event.target.value }))}
              className="text-base"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <BigButton pending={pending} onClick={() => run(() => wizardAction({ type: "story", story }))}>
          Enregistrer
        </BigButton>
        <Button variant="ghost" size="lg" className="h-12" disabled={pending} onClick={() => run(() => wizardAction({ type: "story", story: {} }))}>
          Passer cette étape
        </Button>
      </div>
    </StepFrame>
  );
}

const ASSISTANT_TEXTS = {
  ideas: {
    button: "Idées de l'assistant",
    intro: "En panne d'inspiration ? L'assistant propose des pistes d'apparence, de personnalité et d'histoire.",
    heading: "Idées à reformuler à ta façon (suggestions, sans valeur de règle) :",
  },
  spells: {
    button: "Conseil de l'assistant",
    intro: "Tu hésites ? L'assistant propose une sélection adaptée à ton personnage, parmi les sorts ci-dessous.",
    heading: "Conseil de l'assistant (suggestion, tu restes libre de ton choix) :",
  },
} as const;

/** Aide rédigée par Claude : une suggestion affichée à côté de l'étape, rien n'est enregistré. */
function AssistantHelp({ kind }: { kind: "ideas" | "spells" }) {
  const texts = ASSISTANT_TEXTS[kind];
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function ask() {
    setError(null);
    startTransition(async () => {
      const result = await assistantAction(kind);
      if (!result.ok) setError(result.error);
      else setText(result.data?.text ?? null);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-muted-foreground">{texts.intro}</p>
        <Button variant="outline" size="lg" disabled={pending} onClick={ask}>
          {pending ? <D20Loader /> : <Sparkles aria-hidden />}
          {pending ? "L'assistant réfléchit…" : text ? "Autre proposition" : texts.button}
        </Button>
      </div>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        {text ? (
          <div className="rounded-lg bg-muted/60 px-4 py-3">
            <p className="mb-2 font-medium">{texts.heading}</p>
            <RichText text={text} className="leading-relaxed" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NameStep({ stepId, title, pending, run }: { stepId: string; title: string; pending: boolean; run: Run }) {
  const [name, setName] = useState("");
  return (
    <StepFrame title={title}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => wizardAction({ type: "answer", stepId, values: [name.trim()] }));
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} aria-label={title} maxLength={40} className="h-12 text-lg" />
        <BigButton type="submit" pending={pending} disabled={name.trim().length < 2}>
          Continuer
        </BigButton>
      </form>
    </StepFrame>
  );
}

function DoneStep({ step, pending, run }: { step: Extract<WizardView["step"], { kind: "done" }>; pending: boolean; run: Run }) {
  const router = useRouter();
  return (
    <StepFrame title="Récapitulatif">
      {step.recap ? <RichText text={step.recap} className="space-y-1 text-base leading-relaxed" /> : null}
      {step.errors.length > 0 ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3">
          <p className="font-medium text-destructive">À corriger avant d&apos;enregistrer :</p>
          <ul className="mt-1 list-disc pl-5">
            {step.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {step.warnings.length > 0 ? (
        <div className="rounded-xl border px-4 py-3">
          <p className="font-medium">À noter :</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {step.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-muted-foreground">
        Pour changer un choix sans tout refaire, utilise « Modifier une étape » en bas de page.
      </p>
      <BigButton
        pending={pending}
        disabled={step.errors.length > 0}
        onClick={() =>
          run(
            () => finishCreationAction(),
            (result) => {
              const id = result.ok && result.data && typeof result.data === "object" && "id" in result.data ? result.data.id : null;
              if (id !== null) router.push(`/personnages/${String(id)}?nouveau=1`);
            },
          )
        }
      >
        <Check aria-hidden />
        Enregistrer mon personnage
      </BigButton>
    </StepFrame>
  );
}

function EditPicker({ answered, pending, run }: { answered: WizardView["answered"]; pending: boolean; run: Run }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="edit-step" className="sr-only">
        Modifier une étape
      </Label>
      <NativeSelect id="edit-step" value={value} onChange={(event) => setValue(event.target.value)} className="h-10 max-w-64">
        <option value="">Modifier une étape…</option>
        {answered.map((entry) => (
          <option key={entry.index} value={entry.index}>
            {entry.label}
          </option>
        ))}
      </NativeSelect>
      <Button
        variant="outline"
        size="lg"
        disabled={pending || value === ""}
        onClick={() => run(() => wizardAction({ type: "edit", index: Number(value) }), () => setValue(""))}
      >
        <Pencil aria-hidden />
        Modifier
      </Button>
    </div>
  );
}

function AbandonButton() {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="lg" className="text-destructive">
          <X aria-hidden />
          Abandonner
        </Button>
      }
      title="Abandonner cette création ?"
      description={<p>Tous les choix faits pour ce personnage seront perdus. Les dés déjà lancés aussi.</p>}
      confirmLabel="Abandonner la création"
      action={abandonCreationAction}
      onDone={() => router.push("/personnages")}
    />
  );
}

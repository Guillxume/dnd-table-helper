import "server-only";
import type { WizardState } from "@bot/character/state";
import { draftOf } from "@bot/character/state";
import { explainOption } from "@bot/character/explain";
import { methodOf } from "@bot/character/helpers";
import { nextStep, type Step } from "@bot/character/steps";
import { recapText, validateDraft } from "@bot/character/validate";
import { editOptions, helpFor, isSpellStep, rollsText, summary } from "@bot/character/wizard-view";
import { getSpell } from "@bot/srd/index";
import { abilityIcon, classIcon, schoolIcon, speciesIcon } from "@/components/icons/icon-names";
import type { RpgIconName } from "@/components/icons/rpg-icons";

export type ViewOption = { value: string; label: string; description?: string; details: string; icon?: RpgIconName };

type ChoiceView = {
  id: string;
  title: string;
  help?: string;
  options: ViewOption[];
  min: number;
  max: number;
  isSpell: boolean;
  /** Icône de l'étape (caractéristique en cours de répartition). */
  icon?: RpgIconName;
};
type TextStepView = { id: string; title: string; help: string };

export type WizardStepView =
  | { kind: "name"; id: string; title: string }
  | ({ kind: "select" } & ChoiceView)
  | ({ kind: "multi" } & ChoiceView)
  | ({ kind: "roll" } & TextStepView)
  | ({ kind: "table" } & TextStepView)
  | ({ kind: "story" } & TextStepView)
  | { kind: "confirm"; id: string; title: string; help: string; button: string }
  | { kind: "done"; id: string; recap: string | null; errors: string[]; warnings: string[] };

export type WizardView = {
  name: string;
  campaignName: string | null;
  summary: string;
  /** Informations utiles à l'étape (valeurs tirées, répartition déjà faite…). */
  notes: string[];
  editing: boolean;
  canGoBack: boolean;
  answered: { index: number; label: string }[];
  /** Tirage aux dés (méthode « dés ») : les quatre d6 de chaque lancer et le total des trois meilleurs. */
  diceRolls: { dice: number[]; total: number }[] | null;
  step: WizardStepView;
};

/** Icône d'une option : classe, espèce ou école du sort proposé. */
function optionIcon(stepId: string, value: string): RpgIconName | undefined {
  if (stepId === "class") return classIcon(value);
  if (stepId === "species") return speciesIcon(value);
  if (isSpellStep(stepId)) return schoolIcon(getSpell(value)?.school);
  return undefined;
}

/** Étapes « assign.FOR » et « pb.FOR » : la caractéristique concernée. */
function stepIcon(stepId: string): RpgIconName | undefined {
  const match = /^(?:assign|pb)\.([A-Z]{3})$/.exec(stepId);
  return match?.[1] ? abilityIcon(match[1]) : undefined;
}

/** Données sérialisables pour l'écran de l'assistant (aucune logique de règles côté navigateur). */
export function buildWizardView(state: WizardState): WizardView {
  const draft = draftOf(state);
  const step: Step = nextStep(draft);
  const notes: string[] = [];
  let stepView: WizardStepView;

  switch (step.kind) {
    case "select":
    case "multi": {
      if (step.id.startsWith("assign.")) notes.push(rollsText(draft));
      const diceHints = step.id.startsWith("assign.") && methodOf(draft) === "des";
      const choice: ChoiceView = {
        id: step.id,
        title: step.title,
        help: helpFor(step.id, step.help, "web") || undefined,
        min: step.kind === "multi" ? step.min : 1,
        max: step.kind === "multi" ? step.max : 1,
        isSpell: isSpellStep(step.id),
        icon: stepIcon(step.id),
        options: step.options.map((option) => ({
          icon: optionIcon(step.id, option.value),
          value: option.value,
          label: option.label,
          description: diceHints ? `dés ${draft.rollDice?.[Number(option.value)]?.join(", ") ?? ""}` : option.description,
          details: explainOption(step, option.value, draft),
        })),
      };
      stepView = step.kind === "multi" ? { kind: "multi", ...choice } : { kind: "select", ...choice };
      break;
    }
    case "done": {
      const validation = validateDraft(draft);
      stepView = {
        kind: "done",
        id: step.id,
        recap: validation.sheet ? recapText(validation.sheet) : null,
        errors: validation.errors,
        warnings: validation.warnings,
      };
      break;
    }
    case "name":
      stepView = step;
      break;
    case "confirm":
      stepView = { ...step, help: helpFor(step.id, step.help, "web") };
      break;
    default:
      stepView = { ...step, help: helpFor(step.id, step.help, "web") };
  }

  return {
    name: state.name,
    campaignName: state.campaignName ?? null,
    summary: summary(draft),
    notes,
    editing: Boolean(state.edit),
    canGoBack: state.history.length > 0,
    answered: editOptions(state).map((option) => ({ index: Number(option.value), label: option.label })),
    diceRolls:
      methodOf(draft) === "des" && draft.rolls && draft.rollDice
        ? draft.rolls.map((total, index) => ({ dice: draft.rollDice?.[index] ?? [], total }))
        : null,
    step: stepView,
  };
}

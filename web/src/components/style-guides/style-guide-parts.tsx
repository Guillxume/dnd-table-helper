"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addStyleGuideReferencesAction,
  createStyleGuideAction,
  deleteStyleGuideAction,
  removeStyleGuideReferenceAction,
  saveStyleGuideRulesAction,
  updateStyleGuideInfoAction,
  updateStyleGuideReferenceAction,
} from "@/app/(app)/style-guides/actions";
import { AssetPicker } from "@/components/library/asset-picker";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StyleAspect } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { STYLE_ASPECT_LABELS, STYLE_ASPECT_ORDER } from "@/lib/labels";
import type { RuleMap } from "@/lib/style/merge-rules";
import { cn } from "@/lib/utils";
import { AspectPicker } from "./aspect-picker";

export function NewStyleGuideDialog({
  parents,
  defaultParentId,
  trigger,
}: {
  parents: { id: string; name: string }[];
  defaultParentId?: string;
  trigger?: React.ReactNode;
}) {
  const [state, formAction] = useFormAction(createStyleGuideAction);
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus aria-hidden />
            Nouveau guide
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{defaultParentId ? "Nouvelle variante" : "Nouveau guide"}</DialogTitle>
          <DialogDescription>
            Une variante hérite de toutes les règles du guide principal et peut les préciser, sans jamais les effacer.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <TextField label="Nom" name="name" required maxLength={120} placeholder="Fantasy peinte principale" error={fieldError(state, "name")} />
          <TextAreaField label="Intention" name="description" rows={3} placeholder="À quoi sert ce guide, pour quels types d'images." />
          <SelectField label="Guide principal (pour une variante)" name="parentId" defaultValue={defaultParentId ?? ""}>
            <option value="">Aucun (guide principal)</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </SelectField>
          <FormMessage state={state} />
          <SubmitButton>Créer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditGuideInfoDialog({ id, name, description }: { id: string; name: string; description: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormAction(updateStyleGuideInfoAction.bind(null, id), { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil aria-hidden />
          Nom et intention
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nom et intention du guide</DialogTitle>
          <DialogDescription>Ces informations ne créent pas de nouvelle version.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <TextField label="Nom" name="name" defaultValue={name} required maxLength={120} error={fieldError(state, "name")} />
          <TextAreaField label="Intention" name="description" defaultValue={description ?? ""} rows={3} />
          <FormMessage state={state} />
          <SubmitButton>Enregistrer</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteGuideButton({ id, name, hasVariants }: { id: string; name: string; hasVariants: boolean }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive">
          <Trash2 aria-hidden />
          Supprimer
        </Button>
      }
      title={`Supprimer le guide « ${name} » ?`}
      description={
        hasVariants ? (
          <p>Ce guide a des variantes : supprimez-les d&apos;abord.</p>
        ) : (
          <p>
            Toutes ses versions sont supprimées. Les briefs et générations qui l&apos;utilisaient perdent ce lien mais conservent
            leur texte archivé.
          </p>
        )
      }
      action={() => deleteStyleGuideAction(id)}
      onDone={() => router.push("/style-guides")}
    />
  );
}

/** Formulaire des règles : chaque enregistrement crée une version immuable. */
export function RulesForm({
  guideId,
  ownRules,
  inheritedRules,
  parentName,
}: {
  guideId: string;
  ownRules: RuleMap;
  inheritedRules: RuleMap | null;
  parentName: string | null;
}) {
  const [state, formAction] = useFormAction(saveStyleGuideRulesAction.bind(null, guideId));
  return (
    <form action={formAction} className="max-w-4xl space-y-6">
      {inheritedRules ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Variante de <strong className="text-foreground">{parentName}</strong>. Les règles communes s&apos;appliquent toujours ;
          ce que vous écrivez ici les précise pour cette variante.
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        {STYLE_ASPECT_ORDER.map((aspect) => (
          <div key={aspect} className={cn(aspect === "AVOID" && "md:col-span-2")}>
            <Label htmlFor={`rule-${aspect}`} className="mb-1.5">
              {STYLE_ASPECT_LABELS[aspect]}
            </Label>
            {inheritedRules?.[aspect] ? (
              <p className="mb-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                <span className="font-medium">Règle commune :</span> {inheritedRules[aspect]}
              </p>
            ) : null}
            <Textarea
              id={`rule-${aspect}`}
              name={`rule_${aspect}`}
              defaultValue={ownRules[aspect] ?? ""}
              rows={aspect === "AVOID" ? 4 : 3}
              placeholder={inheritedRules ? "Précision propre à la variante (facultatif)" : "Non défini"}
            />
          </div>
        ))}
      </div>
      <TextField
        label="Note de version"
        name="changeNote"
        maxLength={500}
        placeholder="Ce qui change et pourquoi (facultatif)"
        hint="Une nouvelle version est créée uniquement si une règle change."
      />
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton>Enregistrer une nouvelle version</SubmitButton>
        <Button asChild variant="ghost">
          <Link href={`/style-guides/${guideId}`}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}

type GuideReference = {
  aspects: StyleAspect[];
  note: string | null;
  asset: { id: string; title: string; width: number; height: number; dominantColor: string | null };
};

function useRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return {
    pending,
    run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
      startTransition(async () => {
        const result = await action();
        if (result.ok) {
          if (result.message) toast.success(result.message);
          onSuccess?.();
          router.refresh();
        } else toast.error(result.error);
      });
    },
  };
}

export function GuideReferences({ guideId, references }: { guideId: string; references: GuideReference[] }) {
  const { pending, run } = useRunner();
  const [aspectFilter, setAspectFilter] = useState<StyleAspect | null>(null);
  const [newAspects, setNewAspects] = useState<StyleAspect[]>([]);
  const usedAspects = STYLE_ASPECT_ORDER.filter((aspect) => references.some((reference) => reference.aspects.includes(aspect)));
  const visible = aspectFilter ? references.filter((reference) => reference.aspects.includes(aspectFilter)) : references;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-dashed p-4">
        <AspectPicker value={newAspects} onChange={setNewAspects} label="Aspects illustrés par les images à ajouter" />
        <AssetPicker
          title="Ajouter des références au guide"
          description="Les images choisies seront associées aux aspects sélectionnés (modifiable ensuite)."
          excludeIds={references.map((reference) => reference.asset.id)}
          onConfirm={(assets) =>
            run(
              () => addStyleGuideReferencesAction(guideId, assets.map((asset) => asset.id), newAspects),
              () => setNewAspects([]),
            )
          }
        />
      </div>

      {usedAspects.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par aspect">
          <Button size="xs" variant={aspectFilter ? "ghost" : "secondary"} onClick={() => setAspectFilter(null)}>
            Toutes ({references.length})
          </Button>
          {usedAspects.map((aspect) => (
            <Button
              key={aspect}
              size="xs"
              variant={aspectFilter === aspect ? "secondary" : "ghost"}
              aria-pressed={aspectFilter === aspect}
              onClick={() => setAspectFilter(aspect)}
            >
              {STYLE_ASPECT_LABELS[aspect]}
            </Button>
          ))}
        </div>
      ) : null}

      {references.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune référence. Associez des images à des aspects précis : une image peut ne servir que pour sa texture ou son éclairage.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
          {visible.map((reference) => (
            <li key={reference.asset.id} className="space-y-1.5">
              <Link
                href={`/library/${reference.asset.id}`}
                className="block overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <AssetImage
                  assetId={reference.asset.id}
                  alt={reference.asset.title}
                  width={reference.asset.width}
                  height={reference.asset.height}
                  dominantColor={reference.asset.dominantColor}
                />
              </Link>
              <div className="flex items-start justify-between gap-1">
                <div className="flex flex-wrap gap-1">
                  {reference.aspects.length > 0 ? (
                    reference.aspects.map((aspect) => (
                      <Badge key={aspect} variant="outline" className="text-[0.7rem]">
                        {STYLE_ASPECT_LABELS[aspect]}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Aucun aspect</span>
                  )}
                </div>
                <ReferenceMenu guideId={guideId} reference={reference} pending={pending} run={run} />
              </div>
              {reference.note ? <p className="text-xs text-muted-foreground">{reference.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReferenceMenu({
  guideId,
  reference,
  pending,
  run,
}: {
  guideId: string;
  reference: GuideReference;
  pending: boolean;
  run: (action: () => Promise<ActionResult>, onSuccess?: () => void) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [aspects, setAspects] = useState<StyleAspect[]>(reference.aspects);
  const [note, setNote] = useState(reference.note ?? "");
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Actions sur ${reference.asset.title}`} disabled={pending}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil aria-hidden />
            Aspects et note
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => run(() => removeStyleGuideReferenceAction(guideId, reference.asset.id))}>
            <Trash2 aria-hidden />
            Retirer du guide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reference.asset.title}</DialogTitle>
            <DialogDescription>Ce que cette image illustre dans le guide.</DialogDescription>
          </DialogHeader>
          <AspectPicker value={aspects} onChange={setAspects} />
          <div>
            <Label htmlFor={`note-${reference.asset.id}`} className="mb-1.5">
              Note
            </Label>
            <Textarea
              id={`note-${reference.asset.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Ex. : uniquement la touche picturale du ciel"
            />
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                run(() => updateStyleGuideReferenceAction(guideId, reference.asset.id, aspects, note), () => setEditOpen(false))
              }
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { BadgeCheck, Check, Lock, LockOpen, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addCharacterReferencesAction,
  addTraitAction,
  changeTraitStatusAction,
  deleteCharacterAction,
  deleteTraitAction,
  removeCharacterReferenceAction,
  setReferenceValidatedAction,
  updateTraitAction,
} from "@/app/(app)/characters/actions";
import { AssetPicker } from "@/components/library/asset-picker";
import { AssetImage } from "@/components/shared/asset-image";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FormMessage, SelectField, SubmitButton, TextAreaField, useFormAction } from "@/components/shared/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TraitStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { TRAIT_STATUS_HINTS, TRAIT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Trait = { id: string; status: TraitStatus; content: string; locked: boolean };

const STATUS_ORDER: TraitStatus[] = ["CANON", "PREFERENCE", "PROPOSAL", "EXCLUDED", "UNDETERMINED"];

const STATUS_STYLE: Record<TraitStatus, string> = {
  CANON: "border-primary/40",
  PREFERENCE: "border-info/40",
  PROPOSAL: "border-dashed border-muted-foreground/40",
  EXCLUDED: "border-destructive/40",
  UNDETERMINED: "border-dashed border-border",
};

function useResultRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        onSuccess?.();
        router.refresh();
      } else toast.error(result.error);
    });
  }
  return { pending, run };
}

export function TraitBoard({ characterId, traits }: { characterId: string; traits: Trait[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {STATUS_ORDER.map((status) => {
          const items = traits.filter((trait) => trait.status === status);
          return (
            <section key={status} className={cn("rounded-xl border p-4", STATUS_STYLE[status])} aria-labelledby={`trait-${status}`}>
              <h3 id={`trait-${status}`} className="text-sm font-medium">
                {TRAIT_STATUS_LABELS[status]} <span className="text-muted-foreground">({items.length})</span>
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">{TRAIT_STATUS_HINTS[status]}</p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Rien pour l&apos;instant.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((trait) => (
                    <TraitItem key={`${trait.id}-${trait.content}-${trait.locked}`} trait={trait} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        <AddTraitForm characterId={characterId} />
      </div>
    </div>
  );
}

function TraitItem({ trait }: { trait: Trait }) {
  const { pending, run } = useResultRunner();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(trait.content);

  if (editing) {
    return (
      <li className="space-y-2">
        <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={3} aria-label="Contenu" autoFocus />
        <div className="flex gap-2">
          <Button size="sm" disabled={pending || !content.trim()} onClick={() => run(() => updateTraitAction(trait.id, content, trait.locked), () => setEditing(false))}>
            <Check aria-hidden />
            Enregistrer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X aria-hidden />
            Annuler
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-2 rounded-md bg-background/40 px-2.5 py-2 text-sm">
      {trait.locked ? <Lock className="mt-0.5 size-3.5 shrink-0 text-primary" aria-label="Intangible" /> : null}
      <p className="min-w-0 flex-1 whitespace-pre-line">{trait.content}</p>
      {trait.status !== "CANON" && trait.status !== "EXCLUDED" ? (
        <ConfirmAction
          trigger={
            <Button size="xs" variant="outline" disabled={pending}>
              <BadgeCheck aria-hidden />
              Valider
            </Button>
          }
          title="Valider comme fait canonique ?"
          description={
            <>
              <p className="whitespace-pre-line">« {trait.content} »</p>
              <p>Cet élément sera repris dans la description canonique des prochains briefs.</p>
            </>
          }
          confirmLabel="Valider comme canon"
          action={() => changeTraitStatusAction(trait.id, "CANON")}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Actions sur l'élément" disabled={pending}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil aria-hidden />
            Modifier
          </DropdownMenuItem>
          {trait.status === "CANON" ? (
            <DropdownMenuItem onSelect={() => run(() => updateTraitAction(trait.id, trait.content, !trait.locked))}>
              {trait.locked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
              {trait.locked ? "Déverrouiller" : "Rendre intangible"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Changer le statut</DropdownMenuLabel>
          {STATUS_ORDER.filter((status) => status !== trait.status && status !== "CANON").map((status) => (
            <DropdownMenuItem key={status} disabled={trait.locked} onSelect={() => run(() => changeTraitStatusAction(trait.id, status))}>
              {TRAIT_STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={trait.locked}
            onSelect={() => run(() => deleteTraitAction(trait.id))}
          >
            <Trash2 aria-hidden />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function AddTraitForm({ characterId }: { characterId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<TraitStatus>("PROPOSAL");
  const [state, formAction] = useFormAction(addTraitAction.bind(null, characterId), {
    onSuccess: () => {
      formRef.current?.reset();
      setStatus("PROPOSAL");
      router.refresh();
    },
  });
  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-xl border border-dashed p-4">
      <h3 className="text-sm font-medium">Ajouter un élément</h3>
      <SelectField
        label="Statut"
        name="status"
        value={status}
        onChange={(event) => setStatus(event.target.value as TraitStatus)}
        hint={TRAIT_STATUS_HINTS[status]}
      >
        {STATUS_ORDER.map((value) => (
          <option key={value} value={value}>
            {TRAIT_STATUS_LABELS[value]}
          </option>
        ))}
      </SelectField>
      <TextAreaField label="Contenu" name="content" rows={2} required maxLength={4000} />
      {status === "CANON" ? (
        <div className="flex items-center gap-2">
          <Checkbox id="trait-locked" name="locked" />
          <Label htmlFor="trait-locked" className="font-normal">
            Intangible : ne doit jamais varier d&apos;une illustration à l&apos;autre
          </Label>
        </div>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton size="sm">Ajouter</SubmitButton>
    </form>
  );
}

type Reference = {
  validated: boolean;
  note: string | null;
  asset: { id: string; title: string; width: number; height: number; dominantColor: string | null };
};

export function CharacterReferences({ characterId, references }: { characterId: string; references: Reference[] }) {
  const { pending, run } = useResultRunner();
  return (
    <div className="space-y-3">
      <AssetPicker
        title="Ajouter des références au personnage"
        excludeIds={references.map((reference) => reference.asset.id)}
        onConfirm={(assets) => run(() => addCharacterReferencesAction(characterId, assets.map((asset) => asset.id)))}
      />
      {references.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune référence. Ajoutez des images, puis validez celles qui font foi.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {references.map((reference) => (
            <li key={reference.asset.id} className="space-y-1.5">
              <Link
                href={`/library/${reference.asset.id}`}
                className={cn(
                  "block overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  reference.validated && "ring-2 ring-primary",
                )}
              >
                <AssetImage
                  assetId={reference.asset.id}
                  alt={reference.asset.title}
                  width={reference.asset.width}
                  height={reference.asset.height}
                  dominantColor={reference.asset.dominantColor}
                />
              </Link>
              <div className="flex items-center justify-between gap-1">
                {reference.validated ? (
                  <Badge className="gap-1">
                    <BadgeCheck className="size-3" aria-hidden />
                    Validée
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">À valider</span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label={`Actions sur ${reference.asset.title}`} disabled={pending}>
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => run(() => setReferenceValidatedAction(characterId, reference.asset.id, !reference.validated))}
                    >
                      <BadgeCheck aria-hidden />
                      {reference.validated ? "Retirer la validation" : "Valider comme référence"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => run(() => removeCharacterReferenceAction(characterId, reference.asset.id))}
                    >
                      <Trash2 aria-hidden />
                      Retirer de la fiche
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DeleteCharacterButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive">
          <Trash2 aria-hidden />
          Supprimer
        </Button>
      }
      title={`Supprimer la fiche de ${name} ?`}
      description={
        <p>
          La fiche et ses éléments typés sont supprimés. Les illustrations, briefs et générations sont conservés mais ne seront
          plus rattachés à ce personnage.
        </p>
      }
      action={() => deleteCharacterAction(id)}
      onDone={() => router.push("/characters")}
    />
  );
}

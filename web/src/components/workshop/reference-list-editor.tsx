"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { AssetPicker, type PickedAsset } from "@/components/library/asset-picker";
import { NativeSelect } from "@/components/shared/form-controls";
import { AssetImage } from "@/components/shared/asset-image";
import { AspectPicker } from "@/components/style-guides/aspect-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReferenceRole, type StyleAspect } from "@/generated/prisma/enums";
import { REFERENCE_ROLE_LABELS } from "@/lib/labels";

export type EditableReference = {
  asset: PickedAsset;
  role: ReferenceRole;
  aspects: StyleAspect[];
  note: string;
};

/** Sérialisation attendue par les actions serveur (champ caché « references »). */
export function serializeReferences(references: EditableReference[]): string {
  return JSON.stringify(
    references.map((reference) => ({
      assetId: reference.asset.id,
      role: reference.role,
      aspects: reference.role === "CONTENT" ? [] : reference.aspects,
      note: reference.note.trim() || null,
    })),
  );
}

/**
 * Liste ordonnée des références d'un brief ou d'une génération. L'ordre est
 * celui dans lequel les images seront jointes à ChatGPT (« Image 1 », « Image 2 »…).
 */
export function ReferenceListEditor({
  value,
  onChange,
  max = 12,
}: {
  value: EditableReference[];
  onChange: (references: EditableReference[]) => void;
  max?: number;
}) {
  function update(index: number, patch: Partial<EditableReference>) {
    onChange(value.map((reference, position) => (position === index ? { ...reference, ...patch } : reference)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune référence. Distinguez les références de <strong>style</strong> (texture, éclairage… sans reprendre le sujet)
          des références de <strong>contenu</strong> (ce qu&apos;il faut représenter).
        </p>
      ) : (
        <ol className="space-y-3">
          {value.map((reference, index) => (
            <li key={reference.asset.id} className="flex gap-3 rounded-xl border p-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">Image {index + 1}</span>
                <div className="w-20 overflow-hidden rounded-md bg-muted">
                  <AssetImage
                    assetId={reference.asset.id}
                    alt={reference.asset.title}
                    width={reference.asset.width}
                    height={reference.asset.height}
                    dominantColor={reference.asset.dominantColor}
                  />
                </div>
                <div className="flex">
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Monter">
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label="Descendre"
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{reference.asset.title}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onChange(value.filter((_, position) => position !== index))}
                    aria-label={`Retirer ${reference.asset.title}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                  <div>
                    <Label htmlFor={`role-${reference.asset.id}`} className="mb-1 text-xs">
                      Rôle
                    </Label>
                    <NativeSelect
                      id={`role-${reference.asset.id}`}
                      value={reference.role}
                      onChange={(event) => update(index, { role: event.target.value as ReferenceRole })}
                    >
                      {Object.values(ReferenceRole).map((role) => (
                        <option key={role} value={role}>
                          {REFERENCE_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor={`note-${reference.asset.id}`} className="mb-1 text-xs">
                      {reference.role === "STYLE" ? "Précision (facultatif)" : "Ce qu'il faut reprendre"}
                    </Label>
                    <Input
                      id={`note-${reference.asset.id}`}
                      value={reference.note}
                      onChange={(event) => update(index, { note: event.target.value })}
                      placeholder={reference.role === "STYLE" ? "Ex. : la touche picturale du ciel" : "Ex. : la forme de l'armure"}
                      maxLength={1000}
                    />
                  </div>
                </div>
                {reference.role !== "CONTENT" ? (
                  <AspectPicker
                    value={reference.aspects}
                    onChange={(aspects) => update(index, { aspects })}
                    label="Aspects de style à reprendre"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {value.length < max ? (
        <AssetPicker
          title="Ajouter des références"
          max={max - value.length}
          excludeIds={value.map((reference) => reference.asset.id)}
          onConfirm={(assets) =>
            onChange([...value, ...assets.map((asset) => ({ asset, role: "STYLE" as const, aspects: [], note: "" }))])
          }
        />
      ) : (
        <p className="text-xs text-muted-foreground">Maximum de {max} références atteint.</p>
      )}
    </div>
  );
}

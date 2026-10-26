"use client";

import { StyleAspect } from "@/generated/prisma/enums";
import { STYLE_ASPECT_LABELS, STYLE_ASPECT_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Sélection multiple d'aspects sous forme de puces à bascule (accessibles au clavier). */
export function AspectPicker({
  value,
  onChange,
  exclude = ["AVOID"],
  label = "Aspects",
}: {
  value: StyleAspect[];
  onChange: (aspects: StyleAspect[]) => void;
  exclude?: StyleAspect[];
  label?: string;
}) {
  const selected = new Set(value);
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {STYLE_ASPECT_ORDER.filter((aspect) => !exclude.includes(aspect)).map((aspect) => {
          const isOn = selected.has(aspect);
          return (
            <button
              key={aspect}
              type="button"
              aria-pressed={isOn}
              onClick={() => onChange(isOn ? value.filter((item) => item !== aspect) : [...value, aspect])}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring",
                isOn ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {STYLE_ASPECT_LABELS[aspect]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export const ALL_ASPECTS = Object.values(StyleAspect);

"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DiceRoll = { dice: number[]; total: number };

/** Durée du premier lancer, puis écart entre deux lancers, en millisecondes. */
const FIRST_ROLL_MS = 700;
const NEXT_ROLL_MS = 320;
const TICK_MS = 80;

/** Positions des points d'un d6 sur une grille 3 × 3 (0 à 8, de gauche à droite et de haut en bas). */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DieFace({ value, dropped, rolling }: { value: number; dropped?: boolean; rolling?: boolean }) {
  return (
    <svg
      viewBox="0 0 36 36"
      aria-hidden
      className={cn(
        "size-10 shrink-0 transition-opacity duration-300 sm:size-11",
        rolling && "animate-tumble",
        dropped ? "opacity-35" : "opacity-100",
      )}
    >
      <rect x="2" y="2" width="32" height="32" rx="7" className="fill-card stroke-brass" strokeWidth="1.5" />
      {(PIPS[value] ?? []).map((pip) => (
        <circle key={pip} cx={9 + (pip % 3) * 9} cy={9 + Math.floor(pip / 3) * 9} r="2.9" className="fill-foreground" />
      ))}
      {dropped ? <path d="M7 29 29 7" className="stroke-muted-foreground" strokeWidth="1.5" strokeLinecap="round" /> : null}
    </svg>
  );
}

/** Indice du dé écarté : le plus faible (le premier s'il y a égalité). */
function droppedIndex(dice: number[]): number {
  return dice.indexOf(Math.min(...dice));
}

const randomFace = () => 1 + Math.floor(Math.random() * 6);

/**
 * Animation du tirage des caractéristiques, affichée juste après « Lancer les dés ».
 * Le résultat vient du serveur (tirage définitif) : l'animation ne fait que le révéler.
 * Sans animation si l'appareil demande moins de mouvement.
 */
export function DiceRollReveal({ rolls }: { rolls: DiceRoll[] }) {
  // Le composant n'est monté qu'après un clic (jamais rendu côté serveur) : window est disponible.
  const [instant] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [skipped, setSkipped] = useState(false);
  const [settled, setSettled] = useState(instant ? rolls.length : 0);
  const [faces, setFaces] = useState<number[][]>(() => rolls.map((roll) => roll.dice.map(() => 1)));

  const tick = useEffectEvent((elapsed: number) => {
    const done = skipped ? rolls.length : Math.min(rolls.length, Math.max(0, Math.floor((elapsed - FIRST_ROLL_MS) / NEXT_ROLL_MS) + 1));
    setSettled(done);
    setFaces(rolls.map((roll, index) => (index < done ? roll.dice : roll.dice.map(randomFace))));
    return done >= rolls.length;
  });

  useEffect(() => {
    if (instant) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      if (tick(performance.now() - start)) window.clearInterval(timer);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [instant]);

  const finished = settled >= rolls.length;

  return (
    <section aria-labelledby="dice-roll-title" className="quest-card space-y-4 p-5 pt-8 sm:p-7 sm:pt-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dice-roll-title" className="font-heading text-2xl font-semibold">
          {finished ? "Ton tirage" : "Les dés roulent…"}
        </h2>
        {!finished ? (
          <Button variant="ghost" onClick={() => setSkipped(true)}>
            Voir le résultat tout de suite
          </Button>
        ) : null}
      </div>

      {/* Les faces changent très vite pendant l'animation : masquées aux lecteurs d'écran, qui reçoivent le résumé final. */}
      <ol aria-hidden className="grid gap-2">
        {rolls.map((roll, index) => {
          const done = index < settled;
          const drop = droppedIndex(roll.dice);
          return (
            <li key={index} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
              <span className="w-16 shrink-0 text-sm text-muted-foreground">Lancer {index + 1}</span>
              <span className="flex gap-1.5 sm:gap-2">
                {(faces[index] ?? []).map((value, dieIndex) => (
                  <DieFace key={dieIndex} value={value} rolling={!done} dropped={done && dieIndex === drop} />
                ))}
              </span>
              <span
                className={cn(
                  "ml-auto min-w-10 text-right font-sans text-2xl font-bold tabular-nums text-primary transition-all duration-300",
                  done ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
              >
                {roll.total}
              </span>
            </li>
          );
        })}
      </ol>

      <p role="status" className={cn(!finished && "sr-only")}>
        {finished
          ? `Résultats : ${rolls.map((roll) => roll.total).join(", ")}. Le dé le plus faible de chaque lancer est écarté. Le tirage est définitif : répartis maintenant ces valeurs ci-dessous.`
          : ""}
      </p>
    </section>
  );
}

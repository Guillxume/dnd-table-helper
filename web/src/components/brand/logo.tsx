import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo de la table (design/logo). Fichiers SVG servis tels quels depuis public/brand :
 * pas d'optimisation d'image pour un SVG, et les identifiants internes du dessin
 * ne risquent pas d'entrer en conflit avec la page.
 */
export function Logo({ withText = false, size, className, priority }: { withText?: boolean; size: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src={withText ? "/brand/logo-avec-texte-couleur.svg" : "/brand/logo-sans-texte-couleur.svg"}
      alt={withText ? "La Table de l'Étoile, jeu de rôle" : ""}
      width={size}
      height={size}
      unoptimized
      priority={priority}
      className={cn("shrink-0", className)}
    />
  );
}

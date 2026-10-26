import { RpgIcon } from "@/components/icons/rpg-icons";
import { cn } from "@/lib/utils";

/** Indicateur de chargement : un d20 qui roule (immobile si l'utilisateur limite les animations). */
export function D20Loader({ className, label }: { className?: string; label?: string }) {
  return (
    <RpgIcon
      name="identite-d20-contour"
      className={cn("size-4 shrink-0 animate-roll", className)}
      {...(label ? { "aria-label": label, role: "img", "aria-hidden": false } : {})}
    />
  );
}

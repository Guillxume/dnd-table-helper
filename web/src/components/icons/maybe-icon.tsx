import type { ComponentProps } from "react";
import { RpgIcon, type RpgIconName } from "./rpg-icons";

/** Icône facultative : rien n'est affiché si l'élément n'a pas d'icône (donnée inconnue du design system). */
export function MaybeIcon({ name, ...props }: { name: RpgIconName | undefined } & Omit<ComponentProps<typeof RpgIcon>, "name">) {
  return name ? <RpgIcon name={name} {...props} /> : null;
}

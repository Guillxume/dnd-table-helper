import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { RpgIcon } from "@/components/icons/rpg-icons";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  /** Sans icône précise : le dragon de la table. */
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brass/50 px-6 py-14 text-center">
      {Icon ? <Icon className="mb-3 size-9 text-brass" aria-hidden /> : <RpgIcon name="identite-dragon-contour" className="mb-3 size-10 text-brass" />}
      <h2 className="font-heading text-title-3 font-semibold">{title}</h2>
      {children ? <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

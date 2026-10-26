"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RpgIcon, type RpgIconName } from "@/components/icons/rpg-icons";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; icon: RpgIconName }[] = [
  { href: "/personnages", label: "personnages", icon: "nav-personnages" },
  { href: "/campagnes", label: "campagnes", icon: "nav-campagne" },
];

/** Navigation de l'espace joueurs, sur le bois de l'en-tête. */
export function PlayerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Espace joueurs" className="mx-auto flex max-w-3xl gap-1 px-3 pb-2 sm:px-4">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-2 font-medium whitespace-nowrap transition-colors hover:bg-accent sm:gap-2 sm:px-3",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
          >
            <RpgIcon name={link.icon} className="size-5" />
            {/* « Mes » disparaît sur les plus petits écrans, pour que les deux liens tiennent. */}
            <span>
              <span className="hidden min-[400px]:inline">Mes </span>
              <span className="capitalize min-[400px]:normal-case">{link.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

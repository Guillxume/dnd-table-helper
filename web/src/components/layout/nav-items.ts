import { FolderOpen, LayoutDashboard, Palette, PenLine, Shapes, Sparkles, Tags, Upload } from "lucide-react";
import { type ComponentType, createElement } from "react";
import { RpgIcon, type RpgIconName } from "@/components/icons/rpg-icons";

type IconComponent = ComponentType<{ className?: string }>;

export type NavItem = { href: string; label: string; icon: IconComponent; exact?: boolean };

/** Icône du design system utilisable comme une icône Lucide (même interface). */
function rpgIcon(name: RpgIconName): IconComponent {
  const Icon = ({ className }: { className?: string }) => createElement(RpgIcon, { name, className });
  Icon.displayName = `RpgIcon(${name})`;
  return Icon;
}

export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
      { href: "/library", label: "Bibliothèque", icon: rpgIcon("nav-bibliotheque-images"), exact: true },
      { href: "/library/import", label: "Importer", icon: Upload },
      { href: "/collections", label: "Collections", icon: FolderOpen },
    ],
  },
  {
    title: "Référentiel",
    items: [
      { href: "/characters", label: "Personnages", icon: rpgIcon("nav-personnages") },
      { href: "/style-guides", label: "Direction artistique", icon: Palette },
    ],
  },
  {
    title: "Production",
    items: [
      { href: "/workshop", label: "Atelier de briefs", icon: PenLine },
      { href: "/generations", label: "Générations", icon: Sparkles },
      { href: "/cartes", label: "Cartes de bataille", icon: rpgIcon("nav-carte-bataille") },
    ],
  },
  {
    title: "Organisation",
    items: [
      { href: "/tags", label: "Tags", icon: Tags },
      { href: "/categories", label: "Catégories", icon: Shapes },
    ],
  },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href || (item.href === "/library" && /^\/library\/(?!import)[^/]+$/.test(pathname));
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { PlayerNav } from "@/components/player/player-nav";
import { PlayerSignOut } from "@/components/player/player-sign-out";
import { gameEnabled } from "@/server/env";
import { requireMember } from "@/server/session";
import { currentTheme } from "@/server/theme";

/**
 * Espace des joueurs : volontairement simple (une colonne, gros caractères, peu de liens).
 * L'atelier du MJ reste dans son propre cadre (groupe (app)).
 */
export default async function PlayerLayout({ children }: LayoutProps<"/">) {
  const user = await requireMember();
  return (
    <div className="min-h-dvh">
      <header className="on-wood border-b border-brass/40 bg-wood text-wood-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/personnages" className="flex items-center gap-3 rounded-md font-heading text-lg font-semibold sm:text-xl">
            <Logo size={48} priority className="size-10 sm:size-12" />
            <span className="sr-only sm:not-sr-only">La Table de l&apos;Étoile</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {user.role === "admin" ? (
              <Link href="/" className="rounded-md px-2 py-1 text-sm whitespace-nowrap text-wood-foreground/85 hover:text-wood-foreground hover:underline">
                Atelier<span className="hidden sm:inline"> du MJ</span>
              </Link>
            ) : null}
            <ThemeToggle initial={await currentTheme()} />
            <PlayerSignOut />
          </div>
        </div>
        {gameEnabled() ? <PlayerNav /> : null}
      </header>
      <main id="contenu" className="mx-auto max-w-3xl px-4 py-8 text-base">
        {gameEnabled() ? (
          children
        ) : (
          <section className="quest-card space-y-2 p-7 pt-9">
            <h1 className="font-heading text-2xl font-semibold">Espace des personnages bientôt disponible</h1>
            <p className="text-muted-foreground">
              Le serveur Discord de la table n&apos;est pas encore relié au site (variable DISCORD_GUILD_ID).
              {user.role === "admin" ? " Renseignez-la dans la configuration du site puis redémarrez-le." : " Prévenez le MJ."}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

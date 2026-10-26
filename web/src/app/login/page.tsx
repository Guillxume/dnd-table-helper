import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { discordLoginEnabled } from "@/server/env";
import { getSessionUser } from "@/server/session";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { Logo } from "@/components/brand/logo";
import { DiscordLoginButton, LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : undefined);
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? next : "/personnages");
  const discord = discordLoginEnabled();
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo withText size={200} priority />
          <h1 className="sr-only">La Table de l&apos;Étoile</h1>
          <p className="mt-4 text-muted-foreground">Création de personnages et outils de la campagne</p>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
            La connexion avec Discord n&apos;a pas abouti. Réessaie ; si le problème continue, préviens ton MJ.
          </p>
        ) : null}

        {discord ? (
          <section className="quest-card space-y-3 p-6 pt-9">
            <h2 className="font-heading text-title-3 font-semibold">Joueuses et joueurs</h2>
            <p className="text-muted-foreground">Utilise le même compte Discord que sur le serveur de la table.</p>
            <DiscordLoginButton next={next.startsWith("/personnages") ? next : "/personnages"} />
          </section>
        ) : null}

        <details className="rounded-2xl border p-6" open={!discord}>
          <summary className="cursor-pointer font-medium">Connexion du MJ (e-mail)</summary>
          <div className="mt-4">
            <LoginForm next={next} />
          </div>
        </details>
      </div>
    </main>
  );
}

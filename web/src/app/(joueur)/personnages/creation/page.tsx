import type { Metadata } from "next";
import Link from "next/link";
import { WizardScreen } from "@/components/player/wizard-screen";
import { Button } from "@/components/ui/button";
import { getCurrentWizard } from "@/server/game/character-creation";
import { getGameActor } from "@/server/game/membership";
import { buildWizardView } from "@/server/game/wizard-view";
import { assistantEnabled, gameEnabled } from "@/server/env";
import { requireMember } from "@/server/session";

export const metadata: Metadata = { title: "Création de personnage" };

export default async function CreationPage() {
  const user = await requireMember();
  // Le layout affiche le message de configuration manquante.
  if (!gameEnabled()) return null;
  const wizard = getCurrentWizard(await getGameActor(user));
  if (!wizard) {
    return (
      <div className="quest-card space-y-4 p-7 pt-9">
        <h1 className="font-heading text-2xl font-semibold">Aucune création en cours</h1>
        <p>Commence un personnage depuis ta page d&apos;accueil.</p>
        <Button asChild size="lg">
          <Link href="/personnages">Retour à mes personnages</Link>
        </Button>
      </div>
    );
  }
  return <WizardScreen view={buildWizardView(wizard)} assistant={assistantEnabled()} />;
}

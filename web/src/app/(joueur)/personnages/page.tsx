import { Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { characterLabel } from "@bot/character/label";
import { classIcon } from "@/components/icons/icon-names";
import { MaybeIcon } from "@/components/icons/maybe-icon";
import { RpgIcon, type RpgIconName } from "@/components/icons/rpg-icons";
import { RefreshAccessButton, StartCreationForm } from "@/components/player/player-forms";
import { Button } from "@/components/ui/button";
import { getCurrentWizard, listVisibleCharacters } from "@/server/game/character-creation";
import { getGameActor, listMemberCampaigns } from "@/server/game/membership";
import { gameEnabled } from "@/server/env";
import { requireMember } from "@/server/session";

export const metadata: Metadata = { title: "Mes personnages" };

/** Avis de quête épinglé : un bloc de la page d'accueil. */
function Card({ title, icon, children }: { title: string; icon?: RpgIconName; children: React.ReactNode }) {
  return (
    <section className="quest-card space-y-4 p-5 pt-8 sm:p-7 sm:pt-9">
      <h2 className="flex items-center gap-3 font-heading text-2xl font-semibold">
        {icon ? <RpgIcon name={icon} className="size-7 text-brass" /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

type CharacterRow = { id: number; campaignId: string; draft: { classId?: string } } & Parameters<typeof characterLabel>[0];

function CharacterList({ characters, campaignName }: { characters: CharacterRow[]; campaignName: Map<string, string> }) {
  return (
    <ul className="divide-y">
      {characters.map((character) => (
        <li key={character.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <MaybeIcon name={classIcon(character.draft.classId)} className="size-9 text-brass" />
            <div>
            <Link href={`/personnages/${character.id}`} className="text-lg font-medium hover:underline">
              {characterLabel(character)}
            </Link>
              <p className="text-sm text-muted-foreground">{campaignName.get(character.campaignId) ?? "Campagne archivée"}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="lg">
            <a href={`/api/personnages/${character.id}/pdf`}>
              <RpgIcon name="nav-pdf-telecharger" className="size-5" />
              Fiche PDF
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default async function PlayerHomePage() {
  const user = await requireMember();
  // Le layout affiche le message de configuration manquante.
  if (!gameEnabled()) return null;
  const actor = await getGameActor(user);
  const campaigns = listMemberCampaigns(actor).filter((campaign) => !campaign.archived);
  const wizard = getCurrentWizard(actor);
  const characters = listVisibleCharacters(actor);
  const mine = characters.filter((character) => character.userId === actor.discordId);
  const others = characters.filter((character) => character.userId !== actor.discordId);
  const campaignName = new Map(campaigns.map((campaign) => [campaign.channelId, campaign.name]));

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">
        Bonjour {actor.displayName ?? user.name}
      </h1>

      {!actor.discordId ? (
        <Card title="Création de personnage" icon="nav-creation">
          <p>Les personnages sont rattachés à un compte Discord. Connecte-toi avec Discord pour en créer un.</p>
        </Card>
      ) : campaigns.length === 0 ? (
        <Card title="Aucune campagne pour l'instant" icon="nav-campagne">
          <p>
            {actor.inGuild
              ? "Tu ne fais encore partie d'aucune campagne. Demande à ton MJ de t'ajouter sur Discord, puis vérifie à nouveau."
              : "Ton compte Discord n'est pas membre du serveur de la table. Rejoins le serveur, puis vérifie à nouveau."}
          </p>
          <RefreshAccessButton />
        </Card>
      ) : (
        <>
          {wizard ? (
            <Card title="Ta création en cours" icon="nav-fiche">
              <p className="text-lg">
                <strong>{wizard.name}</strong>
                {wizard.campaignName ? ` · ${wizard.campaignName}` : ""}
              </p>
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/personnages/creation">
                  <Play aria-hidden />
                  Reprendre là où j&apos;en étais
                </Link>
              </Button>
            </Card>
          ) : null}
          <Card title={wizard ? "Ou commencer un autre personnage" : "Créer mon personnage"} icon="nav-creation">
            <p className="text-muted-foreground">
              On avance étape par étape. Tu peux revenir en arrière ou changer un choix à tout moment, et reprendre plus tard :
              tout est enregistré au fur et à mesure.
            </p>
            <StartCreationForm
              campaigns={campaigns.map((campaign) => ({ id: campaign.channelId, name: campaign.name }))}
              replacesCurrent={wizard?.name ?? null}
            />
          </Card>
        </>
      )}

      {mine.length > 0 ? (
        <Card title="Mes personnages" icon="nav-personnages">
          <CharacterList characters={mine} campaignName={campaignName} />
        </Card>
      ) : null}

      {others.length > 0 ? (
        <Card title="Personnages de mes campagnes (MJ)" icon="nav-campagne">
          <CharacterList characters={others} campaignName={campaignName} />
        </Card>
      ) : null}
    </div>
  );
}

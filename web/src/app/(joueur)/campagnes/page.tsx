import type { Metadata } from "next";
import Link from "next/link";
import { formatLocal } from "@bot/time";
import { RpgIcon } from "@/components/icons/rpg-icons";
import { RefreshAccessButton } from "@/components/player/player-forms";
import { gameEnabled } from "@/server/env";
import { listCampaignSummaries } from "@/server/game/campaigns";
import { getGameActor } from "@/server/game/membership";
import { requireMember } from "@/server/session";

export const metadata: Metadata = { title: "Mes campagnes" };

export default async function CampaignsPage() {
  const user = await requireMember();
  // Le layout affiche le message de configuration manquante.
  if (!gameEnabled()) return null;
  const campaigns = listCampaignSummaries(await getGameActor(user)).filter((campaign) => !campaign.archived);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">Mes campagnes</h1>
      {campaigns.length === 0 ? (
        <section className="quest-card space-y-4 p-5 pt-8 sm:p-7 sm:pt-9">
          <p>Tu ne fais encore partie d&apos;aucune campagne. Demande à ton MJ de t&apos;ajouter sur Discord, puis vérifie à nouveau.</p>
          <RefreshAccessButton />
        </section>
      ) : (
        <ul className="grid gap-4">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/campagnes/${campaign.id}`}
                className="quest-card flex items-center gap-4 p-5 pt-8 transition-colors hover:border-primary/60 sm:p-6 sm:pt-8"
              >
                <RpgIcon name="nav-campagne" className="size-10 text-brass" />
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-2xl font-semibold">{campaign.name}</span>
                  <span className="block text-muted-foreground">
                    {campaign.nextSession ? `Prochaine séance : ${formatLocal(new Date(campaign.nextSession))}` : "Pas de séance prévue"}
                  </span>
                </span>
                {campaign.mj ? <span className="rounded-full bg-wax px-3 py-1 text-sm text-wax-foreground">MJ</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

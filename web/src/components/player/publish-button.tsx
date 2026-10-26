"use client";

import { CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import { RpgIcon } from "@/components/icons/rpg-icons";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { requestPublicationAction } from "@/app/(joueur)/personnages/actions";
import { Button } from "@/components/ui/button";
import type { PublicationStatus } from "@/server/game/character-creation";

const REFRESH_EVERY_MS = 10_000;
const MAX_REFRESHES = 18;

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

/** Publication de la fiche dans le salon des fiches de la campagne, faite par le bot. */
export function PublishButton({ characterId, status }: { characterId: number; status: PublicationStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Tant que le bot doit encore agir (demande en attente, ou échec qu'il va retenter), la page se
  // rafraîchit pour afficher le résultat. Au-delà de 3 minutes, on s'arrête : le bot est
  // probablement arrêté, inutile d'interroger le serveur indéfiniment.
  const waiting = status.state === "pending" || (status.state === "failed" && status.willRetry);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (ticks > MAX_REFRESHES) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [waiting, router]);

  function publish() {
    startTransition(async () => {
      const result = await requestPublicationAction(characterId);
      if (result.ok) {
        toast.success(result.message ?? "Publication demandée.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (status.state === "pending") {
    return (
      <p className="flex items-center gap-2 text-muted-foreground" role="status">
        <Clock className="size-5" aria-hidden />
        {gaveUp
          ? "La publication prend plus de temps que prévu. Rechargez la page plus tard ; si rien ne change, prévenez le MJ."
          : "Publication en cours : la fiche apparaîtra sur Discord dans moins d'une minute."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {status.state === "published" ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="size-5 text-primary" aria-hidden />
          Publiée sur Discord le {dateFormat.format(new Date(status.publishedAt))}.
        </p>
      ) : null}
      {status.state === "failed" ? (
        <p className="flex items-start gap-2 text-destructive" role="alert">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            La publication n&apos;a pas abouti : {status.error}
            {status.willRetry ? " Le bot réessaie automatiquement." : ""}
          </span>
        </p>
      ) : null}
      <Button
        variant="outline"
        size="lg"
        className="h-12 text-base"
        // Pendant une nouvelle tentative du bot, une seconde demande publierait la fiche deux fois.
        disabled={pending || (status.state === "failed" && status.willRetry)}
        onClick={publish}
      >
        <RpgIcon name="nav-publier-discord" className="size-5" />
        {status.state === "published" ? "Publier à nouveau sur Discord" : "Publier dans le salon des fiches (Discord)"}
      </Button>
    </div>
  );
}

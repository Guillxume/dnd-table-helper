import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CARNET_TITLES } from "@bot/carnet";
import { CONTENT_NAMES, METHOD_NAMES } from "@bot/character/rules";
import type { CarnetKind } from "@bot/db";
import { PREP_FORMS, type PrepType } from "@bot/prep";
import { STYLE_FIELDS } from "@bot/style";
import {
  CancelSessionButton,
  DeadlineForm,
  PlayerNoteForm,
  PrepPanel,
  RecapDraftForm,
  RecapNotesForm,
  RemoveCarnetButton,
  RulesForm,
  ScheduleSessionForm,
  StyleForm,
} from "@/components/campaigns/campaign-forms";
import { RpgIcon, type RpgIconName } from "@/components/icons/rpg-icons";
import { RichText } from "@/components/player/rich-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { assistantEnabled, gameEnabled } from "@/server/env";
import { DomainError } from "@/server/errors";
import { getBotStore } from "@/server/game/bot-store";
import {
  type CampaignOverview,
  getCampaignOverview,
  getProgress,
  getRecapDraft,
  getStyle,
  listPendingPlayerNotes,
} from "@/server/game/campaigns";
import { type GameActor, getGameActor } from "@/server/game/membership";
import { requireMember } from "@/server/session";

export const metadata: Metadata = { title: "Campagne" };

const TABS = [
  { id: "apercu", label: "Aperçu" },
  { id: "seances", label: "Séances et rappels" },
  { id: "preparer", label: "Préparer" },
  { id: "reglages", label: "Règles et style" },
  { id: "joueurs", label: "Joueurs" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Panel({ title, icon, children, className }: { title: string; icon?: RpgIconName; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("quest-card space-y-4 p-5 pt-8 sm:p-7 sm:pt-9", className)}>
      <h2 className="flex items-center gap-3 font-heading text-2xl font-semibold">
        {icon ? <RpgIcon name={icon} className="size-7 text-brass" /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function CampaignPage({ params, searchParams }: PageProps<"/campagnes/[campaignId]">) {
  const user = await requireMember();
  // Le layout affiche le message de configuration manquante.
  if (!gameEnabled()) return null;
  const { campaignId } = await params;
  const query = await searchParams;
  const actor = await getGameActor(user);
  let overview: CampaignOverview;
  try {
    overview = getCampaignOverview(actor, campaignId);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }
  const requested = typeof query.onglet === "string" ? query.onglet : "apercu";
  const tab: Tab = overview.mj && TABS.some((entry) => entry.id === requested) ? (requested as Tab) : "apercu";
  const id = overview.campaign.id;

  return (
    <div className="space-y-6">
      <Link href="/campagnes" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Mes campagnes
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-semibold">{overview.campaign.name}</h1>
        {overview.mj ? <span className="rounded-full bg-wax px-3 py-1 text-sm text-wax-foreground">Tu es MJ</span> : null}
        {overview.campaign.archived ? <span className="rounded-full border px-3 py-1 text-sm">Archivée</span> : null}
      </header>

      {overview.mj ? (
        <nav aria-label="Rubriques de la campagne" className="flex flex-wrap gap-2 border-b pb-3">
          {TABS.map((entry) => (
            <Link
              key={entry.id}
              href={entry.id === "apercu" ? `/campagnes/${id}` : `/campagnes/${id}?onglet=${entry.id}`}
              aria-current={entry.id === tab ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 font-medium transition-colors hover:bg-accent",
                entry.id === tab ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "text-muted-foreground",
              )}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {tab === "apercu" ? <Overview overview={overview} actor={actor} /> : null}
      {tab === "seances" ? (
        <Sessions
          actor={actor}
          overview={overview}
          draftId={typeof query.brouillon === "string" ? query.brouillon : null}
          published={typeof query.publie === "string" ? query.publie : null}
        />
      ) : null}
      {tab === "preparer" ? <Prepare campaignId={id} /> : null}
      {tab === "reglages" ? <Settings actor={actor} overview={overview} /> : null}
      {tab === "joueurs" ? <Players actor={actor} campaignId={id} /> : null}
    </div>
  );
}

function Overview({ overview, actor }: { overview: CampaignOverview; actor: GameActor }) {
  const id = overview.campaign.id;
  const [latest, ...older] = overview.sessions;
  const kinds = Object.keys(CARNET_TITLES) as CarnetKind[];
  return (
    <div className="space-y-6">
      <Panel title="Prochaine séance" icon="nav-seance">
        {overview.nextSession ? (
          <div className="space-y-1">
            <p className="text-xl font-semibold">{overview.nextSession.label}</p>
            {overview.nextSession.note ? <p>Note du MJ : {overview.nextSession.note}</p> : null}
            <p className="text-muted-foreground">À apporter : ta fiche de personnage, un crayon, une gomme et tes dés.</p>
          </div>
        ) : (
          <p className="text-muted-foreground">Pas de séance prévue pour l&apos;instant.</p>
        )}
        {overview.mj ? (
          <Link href={`/campagnes/${id}?onglet=seances`} className="inline-block text-primary underline-offset-4 hover:underline">
            Fixer ou modifier la séance
          </Link>
        ) : null}
      </Panel>

      {actor.discordId && !overview.campaign.archived ? (
        <Panel title="Mes notes pour le prochain rappel" icon="nav-fiche">
          <PlayerNoteForm campaignId={id} current={overview.myPendingNote} />
        </Panel>
      ) : null}

      <Panel title={latest ? `Rappel de la séance ${latest.number}` : "Rappels de séance"} icon="nav-sorts">
        {latest ? <RichText text={latest.recap} className="leading-relaxed" /> : <p className="text-muted-foreground">Aucun rappel publié pour le moment.</p>}
        {older.length > 0 ? (
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">Rappels des séances précédentes ({older.length})</summary>
            <div className="mt-4 space-y-6">
              {older.map((session) => (
                <article key={session.number} className="space-y-2">
                  <h3 className="font-heading text-xl font-semibold">Séance {session.number}</h3>
                  <RichText text={session.recap} className="leading-relaxed" />
                </article>
              ))}
            </div>
          </details>
        ) : null}
      </Panel>

      <Panel title="Carnet de campagne" icon="nav-campagne">
        {overview.carnet.length === 0 ? (
          <p className="text-muted-foreground">Le carnet se remplit tout seul à chaque rappel publié.</p>
        ) : (
          <div className="space-y-5">
            {kinds.map((kind) => {
              const entries = overview.carnet.filter((entry) => entry.kind === kind);
              if (entries.length === 0) return null;
              return (
                <div key={kind}>
                  <h3 className="mb-2 font-heading text-xl font-semibold">{CARNET_TITLES[kind]}</h3>
                  <ul className="divide-y">
                    {entries.map((entry) => (
                      <li key={entry.name} className="flex items-start justify-between gap-3 py-2">
                        <span>
                          <strong>{entry.name}</strong>
                          {entry.detail ? ` : ${entry.detail}` : ""}
                          <span className="block text-sm text-muted-foreground">
                            Séance {entry.firstSession}
                            {entry.lastSession !== entry.firstSession ? `, revu à la séance ${entry.lastSession}` : ""}
                          </span>
                        </span>
                        {overview.mj ? <RemoveCarnetButton campaignId={id} kind={entry.kind} name={entry.name} /> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Règles de création" icon="nav-creation">
        <ul className="list-disc space-y-1 pl-5">
          <li>Niveau de départ : {overview.rules.level}</li>
          <li>Contenu : {CONTENT_NAMES[overview.rules.content]}</li>
          <li>Caractéristiques : {overview.rules.methods.map((method) => METHOD_NAMES[method]).join(" ; ")}</li>
          {overview.deadline ? <li>Personnages attendus pour le {overview.deadline.label}</li> : null}
        </ul>
      </Panel>
    </div>
  );
}

async function Sessions({
  actor,
  overview,
  draftId,
  published,
}: {
  actor: GameActor;
  overview: CampaignOverview;
  draftId: string | null;
  published: string | null;
}) {
  const id = overview.campaign.id;
  const draft = draftId ? getRecapDraft(actor, id, draftId) : null;
  const playerNotes = await listPendingPlayerNotes(actor, id);
  const posts = getBotStore().recentDiscordPosts(id, 5);
  return (
    <div className="space-y-6">
      {published ? (
        <p role="status" className="rounded-xl border border-success/40 bg-success-bg px-4 py-3 text-success">
          {published}
        </p>
      ) : null}

      <Panel title="Prochaine séance" icon="nav-seance">
        {overview.nextSession ? <p className="text-lg">Prévue : {overview.nextSession.label}</p> : null}
        <ScheduleSessionForm campaignId={id} current={overview.nextSession?.startsAt ?? null} timezone={overview.timezone} />
        {overview.nextSession ? <CancelSessionButton campaignId={id} /> : null}
      </Panel>

      <Panel title={draft ? "Relire et publier le rappel" : "Rappel de la dernière séance"} icon="nav-sorts">
        {draft ? (
          <RecapDraftForm campaignId={id} draft={draft} />
        ) : (
          <>
            {draftId ? <p className="text-warning">Ce brouillon n&apos;existe plus. Recommence à partir de tes notes.</p> : null}
            {playerNotes.length > 0 ? (
              <details className="rounded-lg border p-4" open>
                <summary className="cursor-pointer font-medium">Notes envoyées par les joueurs ({playerNotes.length})</summary>
                <ul className="mt-3 space-y-3">
                  {playerNotes.map((note) => (
                    <li key={`${note.player}-${note.createdAt}`}>
                      <strong>{note.player}</strong> : {note.text}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">L&apos;assistant s&apos;en sert en complément de tes notes, qui font foi.</p>
              </details>
            ) : (
              <p className="text-muted-foreground">Aucune note de joueur en attente.</p>
            )}
            <RecapNotesForm campaignId={id} assistant={assistantEnabled()} />
          </>
        )}
      </Panel>

      {posts.length > 0 ? (
        <Panel title="Messages envoyés sur Discord" icon="nav-publier-discord">
          <ul className="divide-y">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{post.kind === "session" ? "Annonce de séance" : "Rappel de séance"}</span>
                <span className={post.sentAt ? "text-success" : post.error ? "text-error" : "text-muted-foreground"}>
                  {post.sentAt ? "Envoyé" : post.error ? `Échec : ${post.error}` : "En attente (moins d'une minute)"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function Prepare({ campaignId }: { campaignId: string }) {
  if (!assistantEnabled()) {
    return (
      <Panel title="Préparer">
        <p className="text-muted-foreground">L&apos;assistant n&apos;est pas activé sur ce site : utilise /preparer sur Discord.</p>
      </Panel>
    );
  }
  const forms = (Object.keys(PREP_FORMS) as PrepType[]).map((type) => ({
    type,
    title: PREP_FORMS[type].title,
    fields: PREP_FORMS[type].fields.map(({ id, label, placeholder, maxLength, required }) => ({ id, label, placeholder, maxLength, required })),
  }));
  return (
    <Panel title="Préparer avec l'assistant" icon="identite-dragon-contour">
      <p className="text-muted-foreground">
        L&apos;assistant s&apos;appuie sur les derniers rappels, le guide de style et les extraits du SRD. Pour une rencontre, le budget
        d&apos;expérience est calculé par le site, pas par l&apos;assistant.
      </p>
      <PrepPanel campaignId={campaignId} forms={forms} />
    </Panel>
  );
}

function Settings({ actor, overview }: { actor: GameActor; overview: CampaignOverview }) {
  const id = overview.campaign.id;
  return (
    <div className="space-y-6">
      <Panel title="Règles de création" icon="nav-creation">
        <RulesForm
          campaignId={id}
          methods={overview.rules.methods}
          content={overview.rules.content}
          methodNames={METHOD_NAMES}
          contentNames={CONTENT_NAMES}
        />
      </Panel>
      <Panel title="Échéance des personnages" icon="nav-seance">
        {overview.deadline ? <p>Actuellement : {overview.deadline.label}</p> : <p className="text-muted-foreground">Pas d&apos;échéance fixée.</p>}
        <DeadlineForm campaignId={id} deadline={overview.deadline?.iso ?? null} timezone={overview.timezone} />
      </Panel>
      <Panel title="Guide de style" icon="nav-fiche">
        <p className="text-muted-foreground">L&apos;assistant suit ce guide pour rédiger les rappels, les préparations et les idées des joueurs.</p>
        <StyleForm
          campaignId={id}
          style={{ ...getStyle(actor, id) }}
          fields={STYLE_FIELDS.map(({ id: fieldId, label, placeholder }) => ({ id: fieldId, label, placeholder }))}
        />
      </Panel>
    </div>
  );
}

async function Players({ actor, campaignId }: { actor: GameActor; campaignId: string }) {
  const progress = await getProgress(actor, campaignId);
  const groups = [
    { title: "Personnage terminé", items: progress.done.map((entry) => `${entry.player} : ${entry.label}`) },
    { title: "Création en cours", items: progress.inProgress.map((entry) => `${entry.player} : ${entry.name}`) },
    { title: "Attend les dés lancés à la table", items: progress.awaitingTable.map((entry) => `${entry.player} : ${entry.name}`) },
    { title: "Pas encore commencé", items: progress.notStarted },
  ];
  return (
    <div className="space-y-6">
      <Panel title="Documents à imprimer" icon="nav-pdf-telecharger">
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <a href={`/api/campagnes/${campaignId}/groupe`}>
              <RpgIcon name="nav-pdf-telecharger" className="size-5" />
              Fiche de groupe (PDF)
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`/api/campagnes/${campaignId}/export`}>
              <RpgIcon name="nav-pdf-telecharger" className="size-5" />
              Chronique de la campagne (PDF)
            </a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          La fiche de groupe tient sur une page (CA, PV, initiative, perception passive des personnages actifs). La chronique
          rassemble tous les rappels de séance, puis les fiches des personnages.
        </p>
      </Panel>
      <Panel title="Création des personnages" icon="nav-personnages">
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="font-heading text-xl font-semibold">
                {group.title} ({group.items.length})
              </h3>
              {group.items.length ? (
                <ul className="mt-1 list-disc pl-5">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Personne.</p>
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Le site connaît les joueurs ajoutés avec /campagne ajouter-joueur et ceux qui ont commencé un personnage. Les pseudos
          apparaissent dès qu&apos;un joueur s&apos;est connecté une fois au site.
        </p>
      </Panel>
    </div>
  );
}

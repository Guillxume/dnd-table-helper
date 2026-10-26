"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { NativeSelect } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetOrigin } from "@/generated/prisma/enums";
import { ASSET_ORIGIN_LABELS } from "@/lib/labels";
import { pluralize } from "@/lib/text";
import { uploadAsset } from "@/lib/upload-client";
import { ACCEPTED_IMAGE_TYPES, fileExtension, formatBytes } from "@/lib/upload-rules";
import { cn } from "@/lib/utils";
import { Dropzone } from "./dropzone";
import type { LibraryOptions } from "./library-filter-bar";

type QueueStatus = "pending" | "uploading" | "processing" | "created" | "duplicate" | "error";

type QueueItem = {
  key: string;
  file: File;
  status: QueueStatus;
  progress: number;
  message?: string;
  asset?: { id: string; title: string };
};

const CONCURRENCY = 3;
const ACCEPTED_EXTENSIONS: readonly string[] = Object.values(ACCEPTED_IMAGE_TYPES).flat();

function precheck(file: File, maxBytes: number): string | null {
  if (!ACCEPTED_EXTENSIONS.includes(fileExtension(file.name))) {
    return "Format non accepté (JPEG, PNG, WebP ou AVIF).";
  }
  if (file.size > maxBytes) return `Trop volumineux (${formatBytes(file.size)}, maximum ${formatBytes(maxBytes)}).`;
  return null;
}

export function Importer({ options, maxBytes }: { options: LibraryOptions; maxBytes: number }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [origin, setOrigin] = useState<AssetOrigin>("UNKNOWN");
  const [categoryId, setCategoryId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [tags, setTags] = useState("");
  const running = useRef(0);
  const counter = useRef(0);

  function update(key: string, patch: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function processItem(item: QueueItem) {
    update(item.key, { status: "uploading", progress: 0 });
    const result = await uploadAsset(
      item.file,
      { origin, categoryId, collectionId, tags },
      (fraction) =>
        update(item.key, fraction >= 1 ? { status: "processing", progress: 1 } : { progress: fraction }),
    );
    if (result.status === "created" || result.status === "duplicate") {
      update(item.key, { status: result.status, asset: result.asset, progress: 1 });
    } else {
      update(item.key, { status: "error", message: result.reason });
    }
  }

  // File d'attente à concurrence limitée : quelques envois en parallèle, pas des centaines.
  function pump(pending: QueueItem[]) {
    while (running.current < CONCURRENCY && pending.length > 0) {
      const next = pending.shift()!;
      running.current += 1;
      void processItem(next).finally(() => {
        running.current -= 1;
        pump(pending);
      });
    }
  }

  function addFiles(files: File[]) {
    const items: QueueItem[] = files.map((file) => {
      counter.current += 1;
      const error = precheck(file, maxBytes);
      return {
        key: `${counter.current}-${file.name}`,
        file,
        status: error ? "error" : "pending",
        progress: 0,
        message: error ?? undefined,
      };
    });
    setQueue((current) => [...items, ...current]);
    pump(items.filter((item) => item.status === "pending"));
  }

  const counts = queue.reduce(
    (acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }),
    {} as Partial<Record<QueueStatus, number>>,
  );
  const busy = (counts.pending ?? 0) + (counts.uploading ?? 0) + (counts.processing ?? 0) > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Dropzone onFiles={addFiles} hint={`JPEG, PNG, WebP ou AVIF, ${formatBytes(maxBytes)} au maximum par fichier.`} />

        {queue.length > 0 ? (
          <section aria-label="Fichiers importés" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p aria-live="polite">
                {pluralize(counts.created ?? 0, "importée", "importées")}
                {counts.duplicate ? ` · ${pluralize(counts.duplicate, "doublon")}` : ""}
                {counts.error ? ` · ${pluralize(counts.error, "erreur")}` : ""}
                {busy ? " · envoi en cours…" : ""}
              </p>
              {!busy && (counts.created ?? 0) > 0 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/library">Voir dans la bibliothèque</Link>
                </Button>
              ) : null}
            </div>
            <ul className="divide-y rounded-xl border">
              {queue.map((item) => (
                <QueueRow key={item.key} item={item} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="space-y-4 rounded-xl border bg-card p-4 lg:self-start">
        <div>
          <h2 className="text-sm font-medium">Appliquer à cet import</h2>
          <p className="text-xs text-muted-foreground">
            Facultatif. Les métadonnées se complètent ensuite sur chaque fiche.
          </p>
        </div>
        <div>
          <Label htmlFor="import-origin" className="mb-1.5">
            Provenance
          </Label>
          <NativeSelect id="import-origin" value={origin} onChange={(event) => setOrigin(event.target.value as AssetOrigin)}>
            {Object.values(AssetOrigin).map((value) => (
              <option key={value} value={value}>
                {ASSET_ORIGIN_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="import-category" className="mb-1.5">
            Catégorie
          </Label>
          <NativeSelect id="import-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Aucune</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="import-collection" className="mb-1.5">
            Collection
          </Label>
          <NativeSelect id="import-collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
            <option value="">Aucune</option>
            {options.collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="import-tags" className="mb-1.5">
            Tags
          </Label>
          <Input
            id="import-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="séparés par des virgules"
          />
        </div>
      </aside>
    </div>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const statusText: Record<QueueStatus, string> = {
    pending: "En attente",
    uploading: `Envoi… ${Math.round(item.progress * 100)} %`,
    processing: "Traitement (miniatures)…",
    created: "Importée",
    duplicate: "Déjà présente",
    error: item.message ?? "Erreur",
  };
  const done = item.status === "created" || item.status === "duplicate";
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <span className="shrink-0" aria-hidden>
        {item.status === "created" ? (
          <CheckCircle2 className="size-4 text-success" />
        ) : item.status === "duplicate" ? (
          <Copy className="size-4 text-primary" />
        ) : item.status === "error" ? (
          <AlertCircle className="size-4 text-destructive" />
        ) : (
          <D20Loader className={cn("text-muted-foreground", item.status === "pending" && "animate-none")} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.file.name}</p>
        <p className={cn("text-xs", item.status === "error" ? "text-destructive" : "text-muted-foreground")}>
          {statusText[item.status]} · {formatBytes(item.file.size)}
        </p>
        {item.status === "uploading" ? (
          <div
            className="mt-1 h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`Progression de ${item.file.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(item.progress * 100)}
          >
            <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress * 100}%` }} />
          </div>
        ) : null}
      </div>
      {done && item.asset ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/library/${item.asset.id}`}>{item.status === "duplicate" ? "Voir l'existante" : "Compléter"}</Link>
        </Button>
      ) : null}
    </li>
  );
}

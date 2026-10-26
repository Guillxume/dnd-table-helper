/**
 * Contrat du stockage de fichiers. Le reste de l'application ne connaît que
 * cette interface : changer de fournisseur (S3, R2, disque local…) revient à
 * écrire une autre implémentation, sans toucher au métier.
 */
export interface StoredObject {
  body: ReadableStream<Uint8Array>;
  contentType: string | undefined;
  contentLength: number | undefined;
  etag: string | undefined;
}

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Renvoie null si l'objet n'existe pas. */
  get(key: string): Promise<StoredObject | null>;
  exists(key: string): Promise<boolean>;
  /** Supprime les clés données ; une clé absente n'est pas une erreur. */
  deleteMany(keys: string[]): Promise<void>;
  /** Parcourt les clés sous un préfixe (maintenance : recherche d'orphelins, tests). */
  listKeys(prefix: string): AsyncIterable<string>;
  /** Crée le conteneur (bucket) s'il n'existe pas encore. */
  ensureReady(): Promise<void>;
}

/** Emplacements des trois fichiers d'une illustration. */
export function assetObjectKeys(assetId: string, originalExtension: string) {
  return {
    originalKey: `assets/${assetId}/original.${originalExtension}`,
    thumbnailKey: `assets/${assetId}/thumbnail.webp`,
    previewKey: `assets/${assetId}/preview.webp`,
  };
}

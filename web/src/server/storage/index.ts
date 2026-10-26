import { getEnv } from "../env";
import type { ObjectStorage } from "./object-storage";
import { S3ObjectStorage } from "./s3-storage";

export type { ObjectStorage, StoredObject } from "./object-storage";
export { assetObjectKeys } from "./object-storage";

const globalForStorage = globalThis as unknown as { storage?: ObjectStorage };

export function getStorage(): ObjectStorage {
  if (!globalForStorage.storage) {
    const env = getEnv();
    globalForStorage.storage = new S3ObjectStorage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return globalForStorage.storage;
}

/** Réservé aux tests : remplace l'instance partagée. */
export function setStorageForTests(storage: ObjectStorage | undefined): void {
  globalForStorage.storage = storage;
}

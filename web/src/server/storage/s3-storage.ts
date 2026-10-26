import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { ObjectStorage, StoredObject } from "./object-storage";

export type S3StorageConfig = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

function isNotFound(error: unknown): boolean {
  if (error instanceof NoSuchKey || error instanceof NotFound) return true;
  return error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Les passerelles S3 auto-hébergées ne gèrent pas toutes les sommes de
      // contrôle CRC ajoutées par défaut depuis le SDK 3.729 : on ne les envoie
      // que lorsque l'opération l'exige.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.byteLength,
      }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) return null;
      return {
        body: result.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        etag: result.ETag,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    // DeleteObjects accepte au plus 1000 clés par appel.
    for (let start = 0; start < keys.length; start += 1000) {
      const chunk = keys.slice(start, start + 1000);
      const result = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      const failures = (result.Errors ?? []).filter((failure) => failure.Code !== "NoSuchKey");
      if (failures.length > 0) {
        throw new Error(
          `Suppression S3 incomplète : ${failures.map((failure) => `${failure.Key} (${failure.Code})`).join(", ")}`,
        );
      }
    }
  }

  async *listKeys(prefix: string): AsyncIterable<string> {
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) yield object.Key;
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  async ensureReady(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }
}

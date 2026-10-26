import {
  ACCEPTED_IMAGE_TYPES,
  type AcceptedMimeType,
  fileExtension,
  formatBytes,
  isAcceptedMimeType,
} from "@/lib/upload-rules";

export type UploadCandidate = {
  filename: string;
  /** Type annoncé par le navigateur : indicatif, jamais suffisant. */
  declaredType: string;
  bytes: Buffer;
};

export type UploadValidation =
  | { ok: true; mimeType: AcceptedMimeType; extension: string }
  | { ok: false; reason: string };

/**
 * Identifie le format à partir des premiers octets du fichier.
 * Seuls les formats acceptés sont reconnus ; tout le reste renvoie null.
 */
export function sniffImageType(bytes: Buffer): AcceptedMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && pngSignature.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  // AVIF : boîte ISO-BMFF « ftyp » dont la marque principale ou compatible est avif/avis.
  if (bytes.length >= 16 && bytes.toString("ascii", 4, 8) === "ftyp") {
    const boxSize = Math.min(bytes.readUInt32BE(0), bytes.length, 64);
    for (let offset = 8; offset + 4 <= boxSize; offset += 4) {
      const brand = bytes.toString("ascii", offset, offset + 4);
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }
  return null;
}

export function validateUpload(candidate: UploadCandidate, maxBytes: number): UploadValidation {
  const { filename, declaredType, bytes } = candidate;

  if (bytes.byteLength === 0) {
    return { ok: false, reason: "Le fichier est vide." };
  }
  if (bytes.byteLength > maxBytes) {
    return {
      ok: false,
      reason: `Fichier trop volumineux (${formatBytes(bytes.byteLength)}, maximum ${formatBytes(maxBytes)}).`,
    };
  }

  const extension = fileExtension(filename);
  const detected = sniffImageType(bytes);
  if (!detected) {
    return { ok: false, reason: "Format non reconnu : seuls JPEG, PNG, WebP et AVIF sont acceptés." };
  }

  const allowedExtensions: readonly string[] = ACCEPTED_IMAGE_TYPES[detected];
  if (!allowedExtensions.includes(extension)) {
    return {
      ok: false,
      reason: `L'extension « .${extension || "?"} » ne correspond pas au contenu du fichier (${detected}).`,
    };
  }

  // Un type vide est fréquent (certains navigateurs ne le renseignent pas pour AVIF) ;
  // un type renseigné mais contradictoire est en revanche refusé.
  if (declaredType && (!isAcceptedMimeType(declaredType) || declaredType !== detected)) {
    return {
      ok: false,
      reason: `Le type annoncé (${declaredType}) ne correspond pas au contenu du fichier (${detected}).`,
    };
  }

  return { ok: true, mimeType: detected, extension };
}

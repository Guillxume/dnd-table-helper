/** Envoi d'un fichier vers /api/assets avec suivi de progression (navigateur uniquement). */

export type UploadResponse =
  | { status: "created"; asset: { id: string; title: string } }
  | { status: "duplicate"; asset: { id: string; title: string } }
  | { status: "rejected"; reason: string }
  | { status: "error"; reason: string };

export function uploadAsset(
  file: File,
  fields: Record<string, string | undefined>,
  onProgress: (fraction: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve) => {
    const form = new FormData();
    form.set("file", file);
    for (const [key, value] of Object.entries(fields)) {
      if (value) form.set(key, value);
    }
    const request = new XMLHttpRequest();
    request.open("POST", "/api/assets");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const body = request.response as UploadResponse | null;
      if (request.status === 401) {
        resolve({ status: "error", reason: "Session expirée : reconnectez-vous." });
      } else if (body && "status" in body) {
        resolve(body);
      } else {
        resolve({ status: "error", reason: `Réponse inattendue du serveur (${request.status}).` });
      }
    };
    request.onerror = () => resolve({ status: "error", reason: "Connexion interrompue pendant l'envoi." });
    request.send(form);
  });
}

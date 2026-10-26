/**
 * Surveillance : appelle HEARTBEAT_URL (par exemple un contrôle healthchecks.io) toutes les 5 minutes,
 * seulement quand le bot est connecté à Discord. Si les appels s'arrêtent, le service de surveillance prévient.
 */
export const HEARTBEAT_EVERY_MS = 5 * 60 * 1000;

type Fetch = (url: string, init: { method: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

/** Un appel ; retourne true s'il a été fait et a réussi. Ne lève jamais d'erreur. L'URL n'est jamais journalisée. */
export async function beat(url: string, isReady: () => boolean, fetchFn: Fetch = fetch): Promise<boolean> {
  if (!isReady()) return false;
  try {
    const res = await fetchFn(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) console.warn(`Surveillance : l'appel de HEARTBEAT_URL a répondu ${res.status}.`);
    return res.ok;
  } catch (e) {
    console.warn("Surveillance : appel de HEARTBEAT_URL impossible :", e instanceof Error ? e.message : e);
    return false;
  }
}

export function startHeartbeat(url: string, isReady: () => boolean): NodeJS.Timeout {
  void beat(url, isReady);
  return setInterval(() => void beat(url, isReady), HEARTBEAT_EVERY_MS);
}

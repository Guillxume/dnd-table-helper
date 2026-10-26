/**
 * N'accepte qu'un chemin interne (« /library?tag=… ») comme destination après
 * connexion, pour éviter toute redirection ouverte vers un autre site.
 */
export function safeRedirectPath(value: string | undefined | null, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, "http://interne.invalid");
    if (url.origin !== "http://interne.invalid") return fallback;
    if (url.pathname === "/login") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

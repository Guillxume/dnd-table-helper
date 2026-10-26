import { cn } from "@/lib/utils";

export type AssetVariant = "thumbnail" | "preview" | "original";

export function assetFileUrl(assetId: string, variant: AssetVariant): string {
  return `/api/files/${assetId}/${variant}`;
}

type AssetImageProps = {
  assetId: string;
  alt: string;
  width: number;
  height: number;
  variant?: AssetVariant;
  dominantColor?: string | null;
  className?: string;
  /** Les images au-dessus de la ligne de flottaison peuvent être chargées immédiatement. */
  eager?: boolean;
  fit?: "cover" | "contain";
};

/**
 * Image servie par la route protégée /api/files.
 *
 * `next/image` n'est pas utilisé : son optimiseur récupère l'image côté serveur
 * sans les cookies de session et recevrait un 401. Les dérivés (miniature WebP
 * 640 px, aperçu 2048 px) sont déjà produits à l'import.
 */
export function AssetImage({
  assetId,
  alt,
  width,
  height,
  variant = "thumbnail",
  dominantColor,
  className,
  eager = false,
  fit = "cover",
}: AssetImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- voir le commentaire du composant
    <img
      src={assetFileUrl(assetId, variant)}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      style={{ backgroundColor: dominantColor ?? undefined }}
      className={cn("block h-auto w-full", fit === "cover" ? "object-cover" : "object-contain", className)}
    />
  );
}

"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { Maximize, Minus, Plus, ScanSearch, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { assetFileUrl } from "@/components/shared/asset-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const MIN_SCALE = 1;
const MAX_SCALE = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Visionneuse plein écran : molette ou pincement pour zoomer, glisser pour se
 * déplacer, double-clic pour basculer. L'aperçu (2048 px) s'affiche d'abord ;
 * « Pleine résolution » charge l'original pour les détails fins.
 */
export function ZoomViewer({
  open,
  onOpenChange,
  assetId,
  title,
  width,
  height,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  title: string;
  width: number;
  height: number;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [useOriginal, setUseOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
      setUseOriginal(false);
      setLoading(false);
    }
    onOpenChange(next);
  }

  function zoomTo(nextScale: number, focus?: { x: number; y: number }) {
    const target = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (target === 1) {
      reset();
      return;
    }
    // Zoom centré sur le point visé : le point sous le curseur reste immobile.
    if (focus && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const fx = focus.x - rect.left - rect.width / 2;
      const fy = focus.y - rect.top - rect.height / 2;
      const ratio = target / scale;
      setOffset((current) => ({ x: fx - (fx - current.x) * ratio, y: fy - (fy - current.y) * ratio }));
    }
    setScale(target);
  }

  function onPointerDown(event: React.PointerEvent) {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(pinchStart.current.scale * (distance / pinchStart.current.distance), {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
    } else if (scale > 1) {
      setOffset((current) => ({ x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }));
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "+" || event.key === "=") zoomTo(scale * 1.25);
    else if (event.key === "-") zoomTo(scale / 1.25);
    else if (event.key === "0") reset();
    else return;
    event.preventDefault();
  }

  const src = assetFileUrl(assetId, useOriginal ? "original" : "preview");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black p-0 sm:max-w-none"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Visionneuse : molette ou pincement pour zoomer, glisser pour se déplacer, touches plus, moins et zéro.
        </DialogDescription>
        <div className="flex items-center justify-between gap-2 bg-black/80 px-3 py-2 text-white">
          <p className="truncate text-sm">
            {title} <span className="text-white/60">· {width}×{height} px</span>
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => zoomTo(scale / 1.25)} aria-label="Dézoomer" className="text-white hover:bg-white/10">
              <Minus aria-hidden />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">
              {Math.round(scale * 100)} %
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => zoomTo(scale * 1.25)} aria-label="Zoomer" className="text-white hover:bg-white/10">
              <Plus aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="Ajuster à l'écran" className="text-white hover:bg-white/10">
              <Maximize aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoading(true);
                setUseOriginal(true);
              }}
              disabled={useOriginal}
              className="text-white hover:bg-white/10"
            >
              {loading ? <D20Loader /> : <ScanSearch aria-hidden />}
              {useOriginal ? "Pleine résolution" : "Charger la pleine résolution"}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => handleOpenChange(false)} aria-label="Fermer" className="text-white hover:bg-white/10">
              <X aria-hidden />
            </Button>
          </div>
        </div>
        <div
          ref={containerRef}
          className="relative flex-1 touch-none overflow-hidden select-none"
          style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
          onWheel={(event) => zoomTo(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), { x: event.clientX, y: event.clientY })}
          onDoubleClick={(event) => (scale > 1 ? reset() : zoomTo(2.5, { x: event.clientX, y: event.clientY }))}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fichier servi par la route authentifiée */}
          <img
            src={src}
            alt={title}
            draggable={false}
            onLoad={() => setLoading(false)}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "center" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

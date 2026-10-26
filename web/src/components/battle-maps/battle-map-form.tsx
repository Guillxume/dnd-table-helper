"use client";

import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createBattleMapAction, deleteBattleMapAction, updateBattleMapAction } from "@/app/(app)/cartes/actions";
import { AssetPicker, type PickedAsset } from "@/components/library/asset-picker";
import { AssetImage } from "@/components/shared/asset-image";
import { ConfirmAction } from "@/components/shared/confirm-action";
import {
  fieldError,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  useFormAction,
} from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  computePrintLayout,
  dpiQuality,
  effectiveDpi,
  MAX_CELLS,
  MIN_CELLS,
  type PrintLayout,
  rowsForImage,
} from "@/lib/battle-map/layout";
import type { ActionResult } from "@/lib/action-result";

export type BattleMapFormValues = {
  title: string;
  asset: PickedAsset | null;
  columns: number;
  rows: number;
  cellTenthMm: number;
  gridStyle: "DARK" | "LIGHT";
  gridOpacity: number;
  showLabels: boolean;
  notes: string;
};

function safeLayout(columns: number, rows: number, cellTenthMm: number): PrintLayout | null {
  try {
    return computePrintLayout({ columns, rows, cellTenthMm });
  } catch {
    return null;
  }
}

export function BattleMapForm({ mapId, initial }: { mapId?: string; initial: BattleMapFormValues }) {
  const action: (previous: unknown, form: FormData) => Promise<ActionResult> = mapId
    ? updateBattleMapAction.bind(null, mapId)
    : createBattleMapAction;
  const [state, formAction] = useFormAction(action);
  const [values, setValues] = useState(initial);
  const [keepRatio, setKeepRatio] = useState(true);
  const layout = useMemo(
    () => safeLayout(values.columns, values.rows, values.cellTenthMm),
    [values.columns, values.rows, values.cellTenthMm],
  );
  const dpi = values.asset && layout ? effectiveDpi(values.asset.width, values.asset.height, layout) : null;

  function set<K extends keyof BattleMapFormValues>(key: K, value: BattleMapFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setColumns(columns: number) {
    setValues((current) => ({
      ...current,
      columns,
      rows: keepRatio && current.asset ? rowsForImage(columns, current.asset.width, current.asset.height) : current.rows,
    }));
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Aperçu" className="min-w-0 space-y-3">
        {values.asset && layout ? (
          <>
            <MapPreview asset={values.asset} values={values} layout={layout} />
            <PrintSummary layout={layout} dpi={dpi} />
          </>
        ) : (
          <div className="flex aspect-[3/2] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground">Choisissez l&apos;image de la carte : une vue du dessus, sans quadrillage.</p>
            <AssetPicker
              title="Image de la carte"
              max={1}
              confirmLabel="Utiliser cette image"
              onConfirm={([asset]) => {
                if (!asset) return;
                setValues((current) => ({
                  ...current,
                  asset,
                  title: current.title || asset.title,
                  rows: rowsForImage(current.columns, asset.width, asset.height),
                }));
              }}
            />
          </div>
        )}
      </section>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="assetId" value={values.asset?.id ?? ""} />
        <TextField
          label="Titre"
          name="title"
          value={values.title}
          onChange={(event) => set("title", event.target.value)}
          required
          maxLength={200}
          error={fieldError(state, "title")}
        />
        {values.asset ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-muted-foreground">Image : {values.asset.title}</span>
            <AssetPicker
              title="Changer d'image"
              max={1}
              confirmLabel="Utiliser cette image"
              trigger={
                <Button type="button" variant="ghost" size="sm">
                  Changer
                </Button>
              }
              onConfirm={([asset]) => {
                if (asset) setValues((current) => ({ ...current, asset, rows: rowsForImage(current.columns, asset.width, asset.height) }));
              }}
            />
          </div>
        ) : null}

        <fieldset className="space-y-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">Quadrillage</legend>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Colonnes"
              name="columns"
              type="number"
              min={MIN_CELLS}
              max={MAX_CELLS}
              value={values.columns}
              onChange={(event) => setColumns(Number(event.target.value) || MIN_CELLS)}
            />
            <TextField
              label="Rangées"
              name="rows"
              type="number"
              min={MIN_CELLS}
              max={MAX_CELLS}
              value={values.rows}
              disabled={keepRatio && Boolean(values.asset)}
              onChange={(event) => set("rows", Number(event.target.value) || MIN_CELLS)}
            />
          </div>
          {/* Un champ désactivé n'est pas envoyé : la valeur calculée part par ce champ caché. */}
          {keepRatio && values.asset ? <input type="hidden" name="rows" value={values.rows} /> : null}
          <div className="flex items-center gap-2">
            <Checkbox id="keep-ratio" checked={keepRatio} onCheckedChange={(checked) => setKeepRatio(checked === true)} />
            <Label htmlFor="keep-ratio" className="font-normal">
              Rangées calculées d&apos;après les proportions de l&apos;image
            </Label>
          </div>
          <SelectField
            label="Taille d'une case (1,5 m en jeu)"
            name="cellTenthMm"
            value={String(values.cellTenthMm)}
            onChange={(event) => set("cellTenthMm", Number(event.target.value))}
          >
            <option value="250">2,5 cm</option>
            <option value="254">2,54 cm (un pouce)</option>
          </SelectField>
          <SelectField
            label="Couleur des traits"
            name="gridStyle"
            value={values.gridStyle}
            onChange={(event) => set("gridStyle", event.target.value as "DARK" | "LIGHT")}
          >
            <option value="DARK">Foncés (cartes claires)</option>
            <option value="LIGHT">Clairs (cartes sombres)</option>
          </SelectField>
          <div>
            <Label htmlFor="grid-opacity" className="mb-1.5">
              Visibilité des traits : {values.gridOpacity} %
            </Label>
            <input
              id="grid-opacity"
              name="gridOpacity"
              type="range"
              min={10}
              max={100}
              step={5}
              value={values.gridOpacity}
              onChange={(event) => set("gridOpacity", Number(event.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-labels"
              name="showLabels"
              checked={values.showLabels}
              onCheckedChange={(checked) => set("showLabels", checked === true)}
            />
            <Label htmlFor="show-labels" className="font-normal">
              Repères de cases dans les marges (A, B, C… / 1, 2, 3…)
            </Label>
          </div>
        </fieldset>

        <TextAreaField label="Notes" name="notes" value={values.notes} onChange={(event) => set("notes", event.target.value)} rows={3} />
        <FormMessage state={state} />
        <div className="flex flex-wrap gap-2">
          <SubmitButton disabled={!values.asset || !layout}>{mapId ? "Enregistrer" : "Créer la carte"}</SubmitButton>
          {mapId ? (
            <>
              <Button asChild variant="outline">
                <a href={`/api/battle-maps/${mapId}/pdf`}>Télécharger le PDF à imprimer</a>
              </Button>
              <DeleteMapButton mapId={mapId} />
            </>
          ) : null}
        </div>
        {mapId ? <p className="text-xs text-muted-foreground">Le PDF reprend les derniers réglages enregistrés.</p> : null}
      </form>
    </div>
  );
}

/** Aperçu fidèle au PDF : image recadrée au centre, quadrillage, découpage des feuilles. */
function MapPreview({ asset, values, layout }: { asset: PickedAsset; values: BattleMapFormValues; layout: PrintLayout }) {
  const stroke = values.gridStyle === "LIGHT" ? "white" : "black";
  const opacity = values.gridOpacity / 100;
  return (
    <div className="relative overflow-hidden rounded-xl bg-muted" style={{ aspectRatio: `${values.columns} / ${values.rows}` }}>
      <AssetImage
        assetId={asset.id}
        alt={asset.title}
        width={asset.width}
        height={asset.height}
        variant="preview"
        dominantColor={asset.dominantColor}
        eager
        className="absolute inset-0 h-full w-full"
      />
      <svg
        viewBox={`0 0 ${values.columns} ${values.rows}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-label={`Quadrillage de ${values.columns} × ${values.rows} cases, ${layout.pages.length} feuille(s)`}
        role="img"
      >
        {Array.from({ length: values.columns - 1 }, (_, index) => (
          <line key={`c${index}`} x1={index + 1} y1={0} x2={index + 1} y2={values.rows} stroke={stroke} strokeOpacity={opacity} strokeWidth={0.03} />
        ))}
        {Array.from({ length: values.rows - 1 }, (_, index) => (
          <line key={`r${index}`} x1={0} y1={index + 1} x2={values.columns} y2={index + 1} stroke={stroke} strokeOpacity={opacity} strokeWidth={0.03} />
        ))}
        {layout.pages.map((page) => (
          <g key={page.label}>
            <rect
              x={page.firstColumn}
              y={page.firstRow}
              width={page.columns}
              height={page.rows}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={0.12}
              strokeDasharray="0.4 0.25"
            />
            <text
              x={page.firstColumn + page.columns / 2}
              y={page.firstRow + page.rows / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(page.columns, page.rows) / 3}
              fill="white"
              stroke="black"
              strokeWidth={0.05}
              fontWeight={700}
            >
              {page.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PrintSummary({ layout, dpi }: { layout: PrintLayout; dpi: number | null }) {
  const quality = dpi === null ? null : dpiQuality(dpi);
  const size = `${(layout.mapWidthMm / 10).toFixed(1).replace(".", ",")} × ${(layout.mapHeightMm / 10).toFixed(1).replace(".", ",")} cm`;
  return (
    <div className="space-y-2 text-sm">
      <p>
        Carte assemblée : <strong>{size}</strong>, sur <strong>{layout.pages.length} feuille{layout.pages.length > 1 ? "s" : ""} A4</strong>{" "}
        en {layout.orientation === "portrait" ? "portrait" : "paysage"} ({layout.cellsPerPage.columns} × {layout.cellsPerPage.rows} cases par feuille), plus une page de plan
        d&apos;assemblage.
      </p>
      {dpi !== null && quality ? (
        <p className={`flex items-start gap-2 ${quality === "good" ? "text-muted-foreground" : "text-warning"}`}>
          {quality === "good" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            Netteté à l&apos;impression : environ {dpi} points par pouce.{" "}
            {quality === "good"
              ? "Correct pour une carte."
              : quality === "soft"
                ? "L'image sera un peu floue de près. Réduisez le nombre de cases ou utilisez une image plus grande."
                : "L'image sera nettement floue. Réduisez le nombre de cases ou utilisez une image plus grande."}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function DeleteMapButton({ mapId }: { mapId: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button type="button" variant="destructive">
          <Trash2 aria-hidden />
          Supprimer
        </Button>
      }
      title="Supprimer cette carte ?"
      description={<p>Seuls les réglages de quadrillage sont supprimés : l&apos;image reste dans la bibliothèque.</p>}
      action={() => deleteBattleMapAction(mapId)}
      onDone={() => router.push("/cartes")}
    />
  );
}

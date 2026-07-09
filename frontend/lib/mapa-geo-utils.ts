import maplibregl from "maplibre-gl";

// Utilidades de geometría/popup compartidas entre el mapa de Producción y el
// Mapa GIS -- ambos calculan bounds y arman popups con el mismo formato.

export function extenderBounds(bounds: maplibregl.LngLatBounds, coords: unknown) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    bounds.extend([coords[0], coords[1]] as [number, number]);
  } else {
    for (const c of coords) extenderBounds(bounds, c);
  }
}

export function fitBoundsA(map: maplibregl.Map, fc: GeoJSON.FeatureCollection, opts?: maplibregl.FitBoundsOptions) {
  const bounds = new maplibregl.LngLatBounds();
  for (const f of fc.features) {
    if (f.geometry && "coordinates" in f.geometry) extenderBounds(bounds, f.geometry.coordinates);
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, duration: 600, ...opts });
}

export function popupHTML(titulo: string, subtitulo: string | null, filas: { label: string; valor: string }[], nota?: string): string {
  const filasHtml = filas
    .map(
      (f) =>
        `<div class="flex items-baseline justify-between gap-4 text-xs py-0.5"><span class="text-muted-foreground">${f.label}</span><span class="font-semibold text-card-foreground tabular-nums">${f.valor}</span></div>`
    )
    .join("");
  return `
    <div class="px-3.5 py-3 min-w-[190px]">
      <div class="text-sm font-semibold text-card-foreground leading-tight">${titulo}</div>
      ${subtitulo ? `<div class="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mt-0.5 mb-2">${subtitulo}</div>` : `<div class="mb-2"></div>`}
      ${filasHtml}
      ${nota ? `<div class="mt-1.5 pt-1.5 border-t border-border text-[10px] text-muted-foreground italic leading-snug">${nota}</div>` : ""}
    </div>`;
}

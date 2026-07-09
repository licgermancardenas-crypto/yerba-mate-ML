import type maplibregl from "maplibre-gl";

// Compartido entre el mapa de Producción y el Mapa GIS -- mismos 3 basemaps
// raster gratuitos (sin token de Mapbox), para que ambos mapas se vean y se
// comporten igual al cambiar de fondo.
export type Basemap = "topo" | "satelital" | "calles";

export const ESTILO_BASE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    topo: {
      type: "raster",
      tiles: [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: "© OpenTopoMap (CC-BY-SA), SRTM",
    },
    satelital: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© Esri, Maxar, Earthstar Geographics",
    },
    calles: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: "© CARTO, © OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "topo", type: "raster", source: "topo", layout: { visibility: "visible" } },
    { id: "satelital", type: "raster", source: "satelital", layout: { visibility: "none" } },
    { id: "calles", type: "raster", source: "calles", layout: { visibility: "none" } },
  ],
};

/** Centro aproximado de la zona yerbatera (Misiones/Corrientes), reutilizado como vista inicial de ambos mapas. */
export const CENTRO_ZONA_YERBATERA: [number, number] = [-54.9, -27.1];

export function aplicarBasemap(map: maplibregl.Map, basemap: Basemap) {
  if (!map.getLayer("topo")) return;
  map.setLayoutProperty("topo", "visibility", basemap === "topo" ? "visible" : "none");
  map.setLayoutProperty("satelital", "visibility", basemap === "satelital" ? "visible" : "none");
  map.setLayoutProperty("calles", "visibility", basemap === "calles" ? "visible" : "none");
}

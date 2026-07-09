import type { CapaCatalogo, GeoFeatureCollection } from "@/lib/types";
import { formatNumero, formatPct } from "@/lib/format";

export interface Bucket {
  label: string;
  valor: number;
}

export interface Kpi {
  label: string;
  valor: string;
}

export interface ResumenCapa {
  totalFeatures: number;
  kpis: Kpi[];
  ranking: { nombre: string; valor: number }[];
  rankingLabel: string;
}

export interface DetalleFeature {
  titulo: string;
  subtitulo: string | null;
  kpis: Kpi[];
  breakdown: Bucket[];
  breakdownLabel: string;
}

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function texto(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

// El nombre de la unidad geográfica cambia de propiedad según el nivel
// espacial de la capa (provincia="pcia", departamento="depto",
// municipio="municipio", zona="zona"); las capas del INDEC usan "nam".
export function nombreFeature(props: Record<string, unknown>): string {
  return String(
    props.municipio ??
      props.depto ??
      props.pcia ??
      props.zona ??
      props.nam ??
      props.dir_catastral ??
      (props.idplanta != null ? `Planta #${props.idplanta}` : "Sin nombre")
  );
}

// El INYM publica algunos desgloses como un único string empaquetado
// ("2023: 165,63;2022: 137,42;...", con números en formato es-AR) en vez de
// una fila por categoría. Se parsea a pares {label, valor} reales para
// poder graficarlos, sin inventar ninguna cifra.
function parseNumeroEs(s: string): number {
  return parseFloat(s.trim().replace(/\./g, "").replace(",", ".")) || 0;
}

export function parsePares(s: unknown): Bucket[] {
  if (typeof s !== "string" || !s.trim()) return [];
  return s
    .split(";")
    .map((par) => {
      const idx = par.lastIndexOf(":");
      if (idx === -1) return { label: par.trim(), valor: 0 };
      return { label: par.slice(0, idx).trim(), valor: parseNumeroEs(par.slice(idx + 1)) };
    })
    .filter((b) => b.label);
}

// La densidad viene con un nivel adicional ("BAJA Densidad: X@detalle//MEDIA
// Densidad: Y@detalle//ALTA Densidad: Z@detalle") -- se toma solo el total
// de cada categoría (antes del "@"), el desglose fino por planta/ha no se
// muestra para no saturar el gráfico.
export function parseDensidad(s: unknown): Bucket[] {
  if (typeof s !== "string" || !s.trim()) return [];
  return s
    .split("//")
    .map((chunk) => {
      const base = chunk.split("@")[0];
      const idx = base.lastIndexOf(":");
      if (idx === -1) return { label: base.trim(), valor: 0 };
      return { label: base.slice(0, idx).trim(), valor: parseNumeroEs(base.slice(idx + 1)) };
    })
    .filter((b) => b.label);
}

const nf0 = (v: number) => formatNumero(v, 0);
const nf1 = (v: number) => formatNumero(v, 1);

// Campo numérico real que corresponde colorear en el coroplético de cada
// categoría -- null cuando la capa no trae ningún valor cuantitativo propio
// (las administrativas puras del INDEC, o secaderos puntuales, que se
// visualizan como clústeres en vez de relleno).
export function campoChoropleto(categoria: CapaCatalogo["categoria"], geomType: CapaCatalogo["geom_type"]): string | null {
  switch (categoria) {
    case "limites":
    case "edad":
    case "densidad":
      return "sup_ym";
    case "consociado":
      return "sup_cons";
    case "secaderos":
      return geomType === "MultiPolygon" ? "cant" : null;
    default:
      return null;
  }
}

export function resumirCapa(capa: CapaCatalogo, datos: GeoFeatureCollection): ResumenCapa {
  const feats = datos.features;
  const totalFeatures = feats.length;

  if (capa.categoria === "limites" || capa.categoria === "edad" || capa.categoria === "densidad") {
    const totalSupYm = feats.reduce((acc, f) => acc + numero(f.properties.sup_ym), 0);
    const totalSuperficie = feats.reduce((acc, f) => acc + numero(f.properties.superficie), 0);
    const pct = totalSuperficie ? (totalSupYm / totalSuperficie) * 100 : 0;
    return {
      totalFeatures,
      kpis: [
        { label: "Zonas cargadas", valor: nf0(totalFeatures) },
        { label: "Superficie con yerba mate", valor: `${nf0(totalSupYm)} ha` },
        { label: "% de la superficie total", valor: formatPct(pct) },
      ],
      ranking: feats
        .map((f) => ({ nombre: nombreFeature(f.properties), valor: numero(f.properties.sup_ym) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
      rankingLabel: "Superficie con yerba mate (ha)",
    };
  }

  if (capa.categoria === "consociado") {
    const totalConsociado = feats.reduce((acc, f) => acc + numero(f.properties.sup_cons), 0);
    const totalSupYm = feats.reduce((acc, f) => acc + numero(f.properties.sup_ym), 0);
    const pct = totalSupYm ? (totalConsociado / totalSupYm) * 100 : 0;
    return {
      totalFeatures,
      kpis: [
        { label: "Zonas cargadas", valor: nf0(totalFeatures) },
        { label: "Superficie con cultivo consociado", valor: `${nf0(totalConsociado)} ha` },
        { label: "% del cultivo que es consociado", valor: formatPct(pct) },
      ],
      ranking: feats
        .map((f) => ({ nombre: nombreFeature(f.properties), valor: numero(f.properties.sup_cons) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
      rankingLabel: "Superficie con cultivo consociado (ha)",
    };
  }

  if (capa.categoria === "secaderos" && capa.geom_type === "MultiPolygon") {
    const totalCant = feats.reduce((acc, f) => acc + numero(f.properties.cant), 0);
    return {
      totalFeatures,
      kpis: [
        { label: "Zonas cargadas", valor: nf0(totalFeatures) },
        { label: "Secaderos totales", valor: nf0(totalCant) },
      ],
      ranking: feats
        .map((f) => ({ nombre: nombreFeature(f.properties), valor: numero(f.properties.cant) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
      rankingLabel: "Cantidad de secaderos",
    };
  }

  // Secaderos puntuales o capas de contexto del INDEC (límites administrativos
  // puros): no tienen un campo numérico real que sirva de KPI, así que solo
  // se muestra el conteo -- no se inventa un valor.
  return {
    totalFeatures,
    kpis: [{ label: "Features cargadas", valor: nf0(totalFeatures) }],
    ranking: [],
    rankingLabel: "",
  };
}

export function detalleFeature(capa: CapaCatalogo, props: Record<string, unknown>): DetalleFeature {
  const titulo = nombreFeature(props);
  const subtitulo = texto(props.pcia) ?? texto(props.jur) ?? null;

  if (capa.categoria === "limites") {
    const supYm = numero(props.sup_ym);
    const superficie = numero(props.superficie);
    const pct = superficie ? (supYm / superficie) * 100 : 0;
    return {
      titulo,
      subtitulo,
      kpis: [
        { label: "Superficie con yerba mate", valor: `${nf0(supYm)} ha` },
        { label: "Superficie total", valor: `${nf0(superficie)} ha` },
        { label: "% cultivada", valor: formatPct(pct) },
      ],
      breakdown: [],
      breakdownLabel: "",
    };
  }

  if (capa.categoria === "edad") {
    return {
      titulo,
      subtitulo,
      kpis: [{ label: "Superficie con yerba mate", valor: `${nf0(numero(props.sup_ym))} ha` }],
      breakdown: parsePares(props.anio),
      breakdownLabel: "Superficie por año de plantación (ha)",
    };
  }

  if (capa.categoria === "densidad") {
    return {
      titulo,
      subtitulo,
      kpis: [{ label: "Superficie con yerba mate", valor: `${nf0(numero(props.sup_ym))} ha` }],
      breakdown: parseDensidad(props.densidad),
      breakdownLabel: "Superficie por densidad de plantación (ha)",
    };
  }

  if (capa.categoria === "consociado") {
    const supCons = numero(props.sup_cons);
    const supYm = numero(props.sup_ym);
    return {
      titulo,
      subtitulo,
      kpis: [
        { label: "Superficie con cultivo consociado", valor: `${nf0(supCons)} ha` },
        { label: "% del cultivo total", valor: formatPct(supYm ? (supCons / supYm) * 100 : 0) },
      ],
      breakdown: parsePares(props.consociado),
      breakdownLabel: "Superficie por tipo de cobertura (ha)",
    };
  }

  if (capa.categoria === "secaderos") {
    if (capa.geom_type === "Point") {
      return {
        titulo,
        subtitulo: texto(props.dir_catastral),
        kpis: [{ label: "ID de planta", valor: `#${props.idplanta}` }],
        breakdown: [],
        breakdownLabel: "",
      };
    }
    return {
      titulo,
      subtitulo,
      kpis: [{ label: "Secaderos en la zona", valor: nf1(numero(props.cant)) }],
      breakdown: [],
      breakdownLabel: "",
    };
  }

  // Capas de contexto del INDEC: solo metadata administrativa real (sin KPI numérico).
  return {
    titulo,
    subtitulo: texto(props.jur),
    kpis: [
      ...(texto(props.gna) ? [{ label: "Tipo de unidad", valor: texto(props.gna) as string }] : []),
      ...(texto(props.cde) ? [{ label: "Código INDEC", valor: texto(props.cde) as string }] : []),
      ...(texto(props.sag) ? [{ label: "Fuente", valor: texto(props.sag) as string }] : []),
    ],
    breakdown: [],
    breakdownLabel: "",
  };
}

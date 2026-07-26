import { PageHeader } from "@/components/page-header";
import { MapaGisClient } from "@/components/mapa-gis-client";
import { getGeoCatalogo, getGeoLayer } from "@/lib/api";

const CAPA_INICIAL = "view_superficie_por_provincias";

export default async function MapaGisPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const capaSolicitada = typeof sp.capa === "string" ? sp.capa : undefined;

  // censo2010_radios (INDEC 2010, radios censales) y las 3 capas de
  // transporte (IGN) son contexto fijo que se dibuja siempre de fondo -- no
  // son capas seleccionables del dropdown ni pueden ser la capa activa (ver
  // MapaGisClient, que las fetchea aparte por layer_name y las togglea con
  // checkboxes independientes del selector "Capa").
  const catalogo = (await getGeoCatalogo()).filter((c) => c.categoria !== "censo_poblacion" && c.categoria !== "transporte");
  const capaInicial =
    catalogo.find((c) => c.layer_name === capaSolicitada) ??
    catalogo.find((c) => c.layer_name === CAPA_INICIAL) ??
    catalogo[0];
  const datosIniciales = await getGeoLayer(capaInicial.layer_name);

  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Mapa GIS"
        description="Capas del INYM: superficie cultivada, edad de plantación, densidad, cultivo consociado y secaderos."
      />
      <MapaGisClient catalogo={catalogo} capaInicial={capaInicial} datosIniciales={datosIniciales} />
    </main>
  );
}

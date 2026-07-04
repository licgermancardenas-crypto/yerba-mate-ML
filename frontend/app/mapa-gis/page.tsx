import { Map } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function MapaGisPage() {
  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Mapa GIS"
        description="Capas del INYM: superficie cultivada, edad de plantación, densidad y secaderos."
      />
      <ComingSoon icon={Map} label="Mapa GIS" />
    </main>
  );
}

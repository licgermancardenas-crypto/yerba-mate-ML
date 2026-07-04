import { Ship } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function ExportacionesPage() {
  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Exportaciones"
        description="Volumen y valor FOB por país destino — treemap y evolución histórica."
      />
      <ComingSoon icon={Ship} label="Exportaciones" />
    </main>
  );
}

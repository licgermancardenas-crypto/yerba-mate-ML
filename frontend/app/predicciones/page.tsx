import { Brain } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function PrediccionesPage() {
  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="ML / Predicciones"
        description="Selector de modelo, horizonte de pronóstico e intervalos de confianza."
      />
      <ComingSoon icon={Brain} label="ML / Predicciones" />
    </main>
  );
}

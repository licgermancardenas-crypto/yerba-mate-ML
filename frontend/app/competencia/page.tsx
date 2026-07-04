import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function CompetenciaPage() {
  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Competencia"
        description="Evolución de cuotas de mercado por empresa yerbatera."
      />
      <ComingSoon icon={Users} label="Competencia" />
    </main>
  );
}

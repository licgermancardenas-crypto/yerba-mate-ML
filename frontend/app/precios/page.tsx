import { DollarSign } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function PreciosPage() {
  return (
    <main className="p-6 md:p-8">
      <PageHeader
        title="Precios"
        description="Serie histórica de precio de hoja verde y canchada, relación con el IPC."
      />
      <ComingSoon icon={DollarSign} label="Precios" />
    </main>
  );
}

import type { LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card py-24 text-center">
      <span className="flex items-center justify-center size-14 rounded-full bg-primary/10 text-primary ring-4 ring-primary/5">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Esta sección está planificada en el roadmap del proyecto — todavía no tiene datos ni vista implementada.
      </p>
    </div>
  );
}

import type { ReactNode } from "react";

interface InsightChapterProps {
  id: string;
  numero: string;
  titulo: string;
  children: ReactNode;
}

// Único wrapper de "capítulo" narrativo de la app (/insights) -- 9
// consumidores reales justifican el componente genérico (ver CLAUDE.md
// global: evitar abstracción prematura, acá ya hay más de 2 usos reales).
export function InsightChapter({ id, numero, titulo, children }: InsightChapterProps) {
  return (
    <section id={id} className="scroll-mt-20 py-10 border-b border-border last:border-0">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-sm font-mono text-muted-foreground">{numero}</span>
        <h2 className="text-2xl font-semibold text-foreground">{titulo}</h2>
      </div>
      <div className="max-w-3xl space-y-4 text-[15px] text-foreground/90 leading-relaxed">{children}</div>
    </section>
  );
}

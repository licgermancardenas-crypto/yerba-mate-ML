"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

export interface InsightTocItem {
  id: string;
  numero: string;
  label: string;
}

// Scrollspy simple: ventana angosta cerca del top del viewport (no todo el
// viewport) -- así solo el capítulo que está "en lectura" queda resaltado,
// no el que recién empieza a asomar abajo. Primera vez que se usa
// IntersectionObserver en el repo (confirmado, no había ningún otro caso).
export function InsightsToc({ items }: { items: InsightTocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const interseccion = entries.find((e) => e.isIntersecting);
        if (interseccion) setActiveId(interseccion.target.id);
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 }
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="hidden lg:flex lg:flex-col lg:w-56 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto py-10 pr-2 print:hidden">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-3">Contenido</div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = activeId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={active ? "location" : undefined}
              className={`flex items-baseline gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-primary/8 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-xs font-mono opacity-60 shrink-0">{item.numero}</span>
              {item.label}
            </a>
          );
        })}
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-2 mx-3 mt-4 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        <Printer size={14} aria-hidden="true" />
        Imprimir / exportar PDF
      </button>
    </nav>
  );
}

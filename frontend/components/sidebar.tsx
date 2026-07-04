"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Sprout,
  Coffee,
  Ship,
  DollarSign,
  Users,
  Brain,
  Map,
  Menu,
  X,
  Leaf,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/produccion", label: "Producción", icon: Sprout },
  { href: "/consumo", label: "Consumo", icon: Coffee },
  { href: "/exportaciones", label: "Exportaciones", icon: Ship },
  { href: "/precios", label: "Precios", icon: DollarSign },
  { href: "/competencia", label: "Competencia", icon: Users },
  { href: "/predicciones", label: "ML / Predicciones", icon: Brain },
  { href: "/mapa-gis", label: "Mapa GIS", icon: Map },
] as const;

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
              active
                ? "bg-primary text-on-primary"
                : "text-foreground/80 hover:bg-primary/10 hover:text-foreground"
            }`}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra superior mobile */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 bg-primary text-on-primary">
        <span className="flex items-center gap-2 font-semibold">
          <Leaf size={20} aria-hidden="true" />
          Yerba Mate Intelligence
        </span>
        <button
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="cursor-pointer p-2 -mr-2"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 border-r border-border bg-card">
        <div className="flex items-center gap-2 h-16 px-5 border-b border-border">
          <Leaf size={22} className="text-primary" aria-hidden="true" />
          <span className="font-semibold text-card-foreground">Yerba Mate Intelligence</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks pathname={pathname} />
        </div>
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-14 bottom-0 w-72 bg-card overflow-y-auto py-4 shadow-xl">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

    </>
  );
}

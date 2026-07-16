"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Sprout,
  Coffee,
  Ship,
  Package,
  DollarSign,
  Users,
  Brain,
  Map,
  Menu,
  X,
  Leaf,
  Factory,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/produccion", label: "Producción", icon: Sprout },
  { href: "/consumo", label: "Consumo", icon: Coffee },
  { href: "/exportaciones", label: "Exportaciones", icon: Ship },
  { href: "/importaciones", label: "Importaciones", icon: Package },
  { href: "/precios", label: "Precios", icon: DollarSign },
  { href: "/competencia", label: "Competencia", icon: Users },
  { href: "/cadena-productiva", label: "Cadena Productiva", icon: Factory },
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
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active
                ? "bg-white text-primary shadow-md"
                : "text-white/70 hover:bg-white/10 hover:text-white"
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

const SIDEBAR_BG = "bg-gradient-to-b from-[#14532d] via-[#0d3d1f] to-[#052e16]";

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra superior mobile */}
      <header className={`md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 text-white ${SIDEBAR_BG}`}>
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex items-center justify-center size-7 rounded-lg bg-white/15">
            <Leaf size={16} aria-hidden="true" />
          </span>
          Yerba Mate Intelligence
        </span>
        <button
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="cursor-pointer p-2 -mr-2"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Sidebar desktop -- sticky+h-screen: antes no estaba fijado al viewport
          (solo scrolleaba con el resto de la página), pasaba desapercibido
          porque los 10 links de nav siempre entraban en cualquier viewport
          razonable sin necesidad de scroll. El toggle de tema, al ir después
          de todos los links, es el primer elemento que sí puede quedar fuera
          de vista sin este fix. */}
      <aside className={`hidden md:flex md:flex-col md:w-64 md:shrink-0 md:sticky md:top-0 md:h-screen text-white ${SIDEBAR_BG}`}>
        <div className="flex items-center gap-2.5 h-16 px-5 border-b border-white/10">
          <span className="flex items-center justify-center size-9 rounded-xl bg-white/15 shrink-0">
            <Leaf size={20} aria-hidden="true" />
          </span>
          <span className="font-semibold text-white text-sm leading-tight">
            Yerba Mate
            <br />
            Intelligence
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks pathname={pathname} />
        </div>
        <div className="px-3 py-3 border-t border-white/10">
          <ThemeToggle />
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
          <aside className={`absolute left-0 top-14 bottom-0 w-72 overflow-y-auto py-4 shadow-xl text-white flex flex-col ${SIDEBAR_BG}`}>
            <div className="flex-1">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <div className="px-3 py-3 border-t border-white/10">
              <ThemeToggle />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

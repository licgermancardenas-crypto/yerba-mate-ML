"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// `resolvedTheme` viene `undefined` en el primer render del cliente (next-themes
// recién sabe el tema real -- incluido "system" -- después de hidratar), server
// y cliente coinciden en ese primer render (los dos ven `undefined`) así que no
// hace falta un flag de "montado" en un efecto para evitar mismatch de
// hidratación -- solo un parpadeo cosmético de un frame en el ícono/label
// mientras next-themes termina de resolver, no un error de React.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const esOscuro = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={esOscuro}
      onClick={() => setTheme(esOscuro ? "light" : "dark")}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-150 ${className}`}
    >
      {esOscuro ? <Sun size={18} strokeWidth={2} aria-hidden="true" /> : <Moon size={18} strokeWidth={2} aria-hidden="true" />}
      <span>{esOscuro ? "Modo claro" : "Modo oscuro"}</span>
    </button>
  );
}

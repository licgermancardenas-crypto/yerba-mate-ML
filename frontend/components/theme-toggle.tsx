"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// `useSyncExternalStore` en vez de `useEffect` + `setState` (regla
// react-hooks/set-state-in-effect del repo, ver Fase 9) para detectar
// "ya montado en el cliente" -- no hay store real, es el truco estándar
// para esto: `getServerSnapshot` fuerza `false` en SSR/primer render de
// cliente (coinciden, cero mismatch), `getSnapshot` da `true` después.
function useMontadoEnCliente() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

// La suposición previa ("resolvedTheme siempre undefined en el primer
// render del cliente, sin riesgo real de mismatch") resultó falsa en la
// práctica -- reproducido un hydration error real de React (no solo un
// parpadeo cosmético) apenas el usuario ya tenía un tema persistido
// distinto del default. Patrón estándar de next-themes: no renderizar el
// ícono/label real hasta después de montar en el cliente -- antes de eso,
// un placeholder neutro idéntico en server y primer render de cliente.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const montado = useMontadoEnCliente();

  if (!montado) {
    return (
      <button
        type="button"
        aria-label="Cambiar tema"
        disabled
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 ${className}`}
      >
        <Moon size={18} strokeWidth={2} aria-hidden="true" />
        <span>Tema</span>
      </button>
    );
  }

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

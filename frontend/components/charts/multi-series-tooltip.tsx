"use client";

interface MultiSeriesTooltipProps {
  active?: boolean;
  label?: string;
  payload?: { value?: number; name?: string; color?: string }[];
}

export function MultiSeriesTooltip({ active, label, payload }: MultiSeriesTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg min-w-[160px]">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-col gap-1">
        {[...payload].reverse().map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-card-foreground">
              <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-card-foreground">{Number(entry.value).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

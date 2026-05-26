import type { ReactElement } from "react";

import { cn } from "@/lib/utils";

type Props = {
  series: number[];
  crashed?: boolean;
  className?: string;
};

export function CrashMultiplierChart({ series, crashed, className }: Props): ReactElement {
  const w = 400;
  const h = 200;
  const pad = 8;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const data = series.length > 0 ? series : [1];
  const maxY = Math.max(...data, 1.02);
  const minY = 1;
  const range = Math.max(maxY - minY, 0.01);

  const coords = data.map((y, i) => {
    const t = data.length > 1 ? i / (data.length - 1) : 0;
    const x = pad + t * innerW;
    const norm = (y - minY) / range;
    const yy = pad + innerH - norm * innerH * 0.92;
    return { x, y: yy };
  });

  const lineAttr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  let areaPath = `M ${pad} ${h - pad}`;
  for (const c of coords) {
    areaPath += ` L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
  }
  areaPath += ` L ${pad + innerW} ${h - pad} Z`;

  const last = coords[coords.length - 1] ?? { x: pad, y: h - pad };
  const current = data[data.length - 1] ?? 1;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full max-w-full overflow-visible"
        role="img"
        aria-label="Curva do multiplicador"
      >
        <defs>
          <linearGradient id="curveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b66cff" />
            <stop offset="55%" stopColor="#3dff9c" />
            <stop offset="100%" stopColor="#ff5c00" />
          </linearGradient>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(61,255,156,0.35)" />
            <stop offset="100%" stopColor="rgba(9,9,11,0)" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={areaPath} fill="url(#areaFill)" opacity={0.9} />
        <polyline
          fill="none"
          stroke="url(#curveStroke)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={lineAttr}
          filter="url(#glow)"
          className={cn("transition-[stroke] duration-300", crashed && "!stroke-rose-500")}
        />

        <circle
          cx={last.x}
          cy={last.y}
          r={5}
          className={cn(
            "transition-colors duration-300",
            crashed ? "fill-rose-400" : "fill-[var(--color-brand-mint)]",
          )}
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
        <div
          className={cn(
            "rounded-full border border-white/10 bg-black/50 px-4 py-1 font-mono text-2xl font-bold tabular-nums backdrop-blur-sm",
            crashed && "animate-pulse text-rose-300",
            !crashed && "text-white",
          )}
        >
          {current.toFixed(2)}×
        </div>
      </div>
    </div>
  );
}

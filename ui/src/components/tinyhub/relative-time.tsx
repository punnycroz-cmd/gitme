"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RelativeTimeProps {
  /** epoch milliseconds */
  ms?: number | null;
  /** ISO string alternative */
  iso?: string;
  className?: string;
  withTooltip?: boolean;
}

function formatRel(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

function formatAbs(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RelativeTime({
  ms,
  iso,
  className,
  withTooltip = true,
}: RelativeTimeProps) {
  const t = ms ?? (iso ? Date.parse(iso) : NaN);
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(force, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!isFinite(t)) {
    return <span className={className}>—</span>;
  }

  const rel = formatRel(t);
  const abs = formatAbs(t);

  if (!withTooltip) {
    return <span className={className}>{rel}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={new Date(t).toISOString()}
          className={className}
          tabIndex={0}
        >
          {rel}
        </time>
      </TooltipTrigger>
      <TooltipContent>{abs}</TooltipContent>
    </Tooltip>
  );
}

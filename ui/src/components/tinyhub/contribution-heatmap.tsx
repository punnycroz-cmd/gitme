"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarDays, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatNumber } from "./utils";

interface HeatmapDay {
  date: string;
  count: number;
  future: boolean;
}

interface HeatmapResponse {
  weeks: HeatmapDay[][];
  total: number;
  maxCount: number;
  weeksSpan: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/// Pick a fill color based on count relative to max (GitHub-style 4-level).
function levelClass(count: number, max: number): string {
  if (count === 0) return "bg-muted/40";
  const ratio = max > 0 ? count / max : 0;
  if (ratio <= 0.25) return "bg-emerald-200 dark:bg-emerald-900";
  if (ratio <= 0.5) return "bg-emerald-400 dark:bg-emerald-700";
  if (ratio <= 0.75) return "bg-emerald-500 dark:bg-emerald-500";
  return "bg-emerald-600 dark:bg-emerald-400";
}

export function ContributionHeatmap() {
  const [data, setData] = React.useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<HeatmapDay | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/activity/heatmap", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as HeatmapResponse;
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load heatmap");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute month labels (one per ~4 weeks).
  const monthLabels: Array<{ label: string; weekIndex: number }> = [];
  if (data) {
    let lastMonth = -1;
    data.weeks.forEach((week, wi) => {
      const firstDay = week[0];
      if (!firstDay || firstDay.future) return;
      const month = parseInt(firstDay.date.slice(5, 7), 10) - 1;
      if (month !== lastMonth) {
        monthLabels.push({ label: MONTH_LABELS[month], weekIndex: wi });
        lastMonth = month;
      }
    });
  }

  return (
    <Card className="tinyhub-view-enter py-0 overflow-hidden">
      <CardHeader className="px-4 sm:px-6 py-3 flex-row items-center justify-between space-y-0 border-b bg-muted/20">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarDays className="size-4 tinyhub-accent" />
          Contributions
          <span className="text-xs text-muted-foreground font-normal hidden sm:inline">
            (last 52 weeks)
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {loading ? (
            <Skeleton className="h-5 w-16" />
          ) : error ? null : data ? (
            <>
              <Badge variant="secondary" className="font-mono text-[10px] h-5">
                {formatNumber(data.total)} commits
              </Badge>
              {data.maxCount > 0 && (
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] h-5 hidden sm:inline-flex"
                >
                  <TrendingUp className="size-3" />
                  peak {data.maxCount}/day
                </Badge>
              )}
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="px-4 sm:px-6 py-4">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="px-4 sm:px-6 py-4 text-xs text-destructive">
            Failed to load heatmap: {error}
          </div>
        ) : !data || data.total === 0 ? (
          <div className="px-4 sm:px-6 py-6 flex items-center gap-3">
            <div className="grid place-items-center size-9 rounded-md bg-muted">
              <CalendarDays className="size-4 text-muted-foreground" />
            </div>
            <div className="text-sm text-muted-foreground">
              No contributions yet. Push your first project to start filling the
              grid!
            </div>
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-4 overflow-x-auto tinyhub-scroll">
            <div className="inline-flex flex-col gap-1 min-w-max">
              {/* Month labels row */}
              <div className="flex gap-[3px] pl-8 h-4">
                {data.weeks.map((_, wi) => {
                  const ml = monthLabels.find((m) => m.weekIndex === wi);
                  return (
                    <div
                      key={wi}
                      className="w-[11px] text-[9px] text-muted-foreground leading-4"
                    >
                      {ml ? ml.label : ""}
                    </div>
                  );
                })}
              </div>
              {/* Grid: day labels + weeks */}
              <div className="flex gap-[3px]">
                {/* Day labels column */}
                <div className="flex flex-col gap-[3px] w-7 shrink-0">
                  {DAY_LABELS.map((label, di) => (
                    <div
                      key={di}
                      className="h-[11px] text-[9px] text-muted-foreground leading-[11px] text-right pr-1"
                    >
                      {di % 2 === 1 ? label : ""}
                    </div>
                  ))}
                </div>
                {/* Weeks */}
                {data.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day, di) => (
                      <motion.div
                        key={`${wi}-${di}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.2,
                          delay: Math.min((wi * 7 + di) * 0.003, 0.8),
                        }}
                        className={cn(
                          "size-[11px] rounded-[2px] cursor-default",
                          day.future
                            ? "bg-transparent"
                            : levelClass(day.count, data.maxCount),
                          hovered?.date === day.date &&
                            "ring-1 ring-foreground/60 ring-offset-1 ring-offset-background"
                        )}
                        onMouseEnter={() => setHovered(day)}
                        onMouseLeave={() => setHovered(null)}
                        title={`${day.date}: ${day.count} commit${day.count === 1 ? "" : "s"}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              {/* Legend + hover info */}
              <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-muted-foreground">
                <span>
                  {hovered && !hovered.future ? (
                    <span className="font-mono">
                      {hovered.date}:{" "}
                      <strong className="text-foreground">
                        {hovered.count} commit{hovered.count === 1 ? "" : "s"}
                      </strong>
                    </span>
                  ) : (
                    <span>Hover a day for details</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  Less
                  <span className="size-[11px] rounded-[2px] bg-muted/40" />
                  <span className="size-[11px] rounded-[2px] bg-emerald-200 dark:bg-emerald-900" />
                  <span className="size-[11px] rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
                  <span className="size-[11px] rounded-[2px] bg-emerald-500 dark:bg-emerald-500" />
                  <span className="size-[11px] rounded-[2px] bg-emerald-600 dark:bg-emerald-400" />
                  More
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

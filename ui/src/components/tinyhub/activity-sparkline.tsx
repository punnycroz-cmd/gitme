"use client";

// TinyHub — Dashboard activity sparkline.
// Renders a polished 30-day commit-activity bar chart (oldest → newest)
// using inline SVG (no chart library). Fetches its own data from /api/activity.

import * as React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { formatNumber } from "./utils";
import type { ProjectSummary } from "./types";

interface ActivitySparklineProps {
  /// Used to acknowledge how many projects exist (informational).
  projects: ProjectSummary[];
  /// Optional: callback when a day bar is clicked (e.g. to filter History).
  onSelectDate?: (date: string) => void;
  /// Optional: the currently-selected date (highlights that bar).
  selectedDate?: string | null;
}

interface ActivityDay {
  date: string;
  count: number;
  projects: number;
}

interface ActivityResponse {
  days: ActivityDay[];
  total: number;
  maxDay: number;
  maxDate: string | null;
}

const DAY_COUNT = 30;
const VIEWBOX_W = 300;
const VIEWBOX_H = 64;
const BAR_PITCH = VIEWBOX_W / DAY_COUNT; // 10
const BAR_WIDTH = 7;
const BAR_INSET = (BAR_PITCH - BAR_WIDTH) / 2; // 1.5
const MAX_BAR_H = 52; // leaves headroom at the top
const TOP_PAD = 6;
const BASELINE_H = 2; // visible baseline tick on 0-count days

export function ActivitySparkline({
  projects,
  onSelectDate,
  selectedDate,
}: ActivitySparklineProps) {
  const [data, setData] = React.useState<ActivityResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/activity", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as ActivityResponse;
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load activity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="tinyhub-view-enter py-0 overflow-hidden">
      <CardHeader className="px-4 sm:px-6 py-3 flex-row items-center justify-between space-y-0 border-b bg-muted/20">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="size-4 tinyhub-accent" />
          Commit activity
          <span className="text-xs text-muted-foreground font-normal hidden sm:inline">
            (last {DAY_COUNT} days)
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {loading ? (
            <Skeleton className="h-5 w-20" />
          ) : error ? null : data ? (
            <>
              <Badge variant="secondary" className="font-mono text-[10px] h-5">
                {formatNumber(data.total)} commits
              </Badge>
              {data.maxDay > 0 && (
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] h-5 hidden sm:inline-flex"
                  title={data.maxDate ? `Peak on ${data.maxDate}` : undefined}
                >
                  peak {data.maxDay}
                </Badge>
              )}
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="px-4 sm:px-6 py-4">
            <Skeleton className="h-16 w-full" />
            <div className="flex items-center justify-between mt-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
        ) : error ? (
          <div className="px-4 sm:px-6 py-6 text-xs text-destructive flex items-center gap-2">
            <span>Failed to load activity: {error}</span>
          </div>
        ) : !data || data.total === 0 ? (
          <EmptyActivity projectCount={projects.length} />
        ) : (
          <SparklineSvg
            days={data.days}
            maxDay={data.maxDay}
            onSelectDate={onSelectDate}
            selectedDate={selectedDate}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SparklineSvg({
  days,
  maxDay,
  onSelectDate,
  selectedDate,
}: {
  days: ActivityDay[];
  maxDay: number;
  onSelectDate?: (date: string) => void;
  selectedDate?: string | null;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const hoveredDay = hovered !== null ? days[hovered] : null;
  // Tooltip x position in px, based on bar center within the container.
  const hoveredXpx =
    hovered !== null && width > 0
      ? ((hovered + 0.5) / DAY_COUNT) * width
      : 0;
  // Flip tooltip to the left half if it would overflow the right edge.
  const tooltipSide: "left" | "right" =
    hovered !== null && width > 0
      ? hoveredXpx > width * 0.7
        ? "right"
        : "left"
      : "left";

  return (
    <div
      ref={containerRef}
      className="relative px-4 sm:px-6 pt-4 pb-3"
      onMouseLeave={() => setHovered(null)}
    >
      {/* Tooltip */}
      {hoveredDay && width > 0 && (
        <div
          className="pointer-events-none absolute top-1 z-10"
          style={{
            left: hoveredXpx,
            transform:
              tooltipSide === "right"
                ? "translateX(-100%) translateX(8px)"
                : "translateX(-50%)",
          }}
        >
          <div className="rounded-md border bg-popover px-2.5 py-1.5 shadow-md text-[11px] leading-tight whitespace-nowrap">
            <div className="font-mono font-medium">{hoveredDay.date}</div>
            <div className="text-emerald-600 dark:text-emerald-400 tabular-nums">
              {hoveredDay.count}{" "}
              {hoveredDay.count === 1 ? "commit" : "commits"}
            </div>
            <div className="text-muted-foreground tabular-nums">
              {hoveredDay.projects}{" "}
              {hoveredDay.projects === 1 ? "project" : "projects"}
            </div>
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="none"
        width="100%"
        height="64"
        role="img"
        aria-label="Bar chart of commits per day for the last 30 days"
        className="block overflow-visible"
      >
        {/* Subtle baseline */}
        <line
          x1={0}
          x2={VIEWBOX_W}
          y1={VIEWBOX_H - 0.5}
          y2={VIEWBOX_H - 0.5}
          className="stroke-border"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />

        {days.map((d, i) => {
          const ratio = maxDay > 0 ? d.count / maxDay : 0;
          const isActive = d.count > 0;
          const h = isActive
            ? Math.max(4, ratio * MAX_BAR_H + TOP_PAD)
            : BASELINE_H;
          const x = i * BAR_PITCH + BAR_INSET;
          const y = VIEWBOX_H - h;
          const isHovered = hovered === i;
          const isSelected = selectedDate === d.date;
          const dim = hovered !== null && !isHovered && !isSelected;
          const clickable = !!onSelectDate && isActive;
          return (
            <g key={d.date}>
              {/* Invisible hit area covering full bar pitch */}
              <rect
                x={i * BAR_PITCH}
                y={0}
                width={BAR_PITCH}
                height={VIEWBOX_H}
                fill="transparent"
                style={{ cursor: clickable ? "pointer" : "default" }}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onClick={() => {
                  if (clickable) onSelectDate!(d.date);
                }}
                onKeyDown={(e) => {
                  if (clickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelectDate!(d.date);
                  }
                }}
                tabIndex={clickable ? 0 : -1}
                role="img"
                aria-label={`${d.date}: ${d.count} commits across ${d.projects} projects${
                  clickable ? " — click to filter history" : ""
                }`}
              />
              {/* Selected-day highlight ring */}
              {isSelected && (
                <rect
                  x={i * BAR_PITCH + 0.5}
                  y={0.5}
                  width={BAR_PITCH - 1}
                  height={VIEWBOX_H - 1}
                  rx={1.5}
                  fill="none"
                  className="stroke-emerald-500 dark:stroke-emerald-400"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: "none" }}
                />
              )}
              {/* The bar */}
              <motion.rect
                x={x}
                width={BAR_WIDTH}
                rx={1.5}
                initial={{ height: 0, y: VIEWBOX_H }}
                animate={{ height: h, y }}
                transition={{
                  duration: 0.5,
                  delay: Math.min(i * 0.018, 0.5),
                  ease: "easeOut",
                }}
                className={cn(
                  isActive
                    ? "fill-emerald-500 dark:fill-emerald-400"
                    : "fill-muted-foreground/25",
                  isSelected && "fill-emerald-600 dark:fill-emerald-300"
                )}
                style={{
                  pointerEvents: "none",
                  opacity: dim ? 0.4 : 1,
                  transition: "opacity 120ms ease-out",
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Footer: date range + legend */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span className="font-mono">{days[0]?.date}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-[2px] bg-emerald-500 dark:bg-emerald-400" />
            active
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-[2px] bg-muted-foreground/25" />
            none
          </span>
        </span>
        <span className="font-mono">today</span>
      </div>
    </div>
  );
}

function EmptyActivity({ projectCount }: { projectCount: number }) {
  return (
    <div className="px-4 sm:px-6 py-6 flex items-center gap-3">
      <div className="grid place-items-center size-9 rounded-md bg-muted">
        <Sparkles className="size-4 text-muted-foreground" />
      </div>
      <div className="text-sm">
        <div className="font-medium">No commits in the last 30 days</div>
        <p className="text-xs text-muted-foreground">
          {projectCount === 0
            ? "Push your first project to see activity here."
            : "Make a change in the Browser editor to start the chart."}
        </p>
      </div>
    </div>
  );
}

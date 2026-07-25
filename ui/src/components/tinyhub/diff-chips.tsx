"use client";

import { Plus, Pencil, Minus, File } from "lucide-react";

import { cn } from "@/lib/utils";

interface DiffChipsProps {
  stats: { added: number; modified: number; deleted: number; unchanged?: number };
  className?: string;
  showUnchanged?: boolean;
  size?: "sm" | "default";
}

export function DiffChips({
  stats,
  className,
  showUnchanged = false,
  size = "default",
}: DiffChipsProps) {
  const px = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md font-medium",
          px,
          "tinyhub-chip-add",
          stats.added === 0 && "opacity-40"
        )}
        title={`${stats.added} added`}
      >
        <Plus className="size-3" />
        {stats.added}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md font-medium",
          px,
          "tinyhub-chip-mod",
          stats.modified === 0 && "opacity-40"
        )}
        title={`${stats.modified} modified`}
      >
        <Pencil className="size-3" />
        {stats.modified}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md font-medium",
          px,
          "tinyhub-chip-del",
          stats.deleted === 0 && "opacity-40"
        )}
        title={`${stats.deleted} deleted`}
      >
        <Minus className="size-3" />
        {stats.deleted}
      </span>
      {showUnchanged && typeof stats.unchanged === "number" && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md font-medium px-2 py-0.5 text-xs",
            "bg-muted text-muted-foreground border border-border"
          )}
          title={`${stats.unchanged} unchanged`}
        >
          <File className="size-3" />
          {stats.unchanged}
        </span>
      )}
    </div>
  );
}

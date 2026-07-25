"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  accent?: "neutral" | "add" | "mod" | "del";
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "neutral",
  loading = false,
}: StatCardProps) {
  const accentClasses: Record<NonNullable<StatCardProps["accent"]>, string> = {
    neutral: "text-foreground",
    add: "tinyhub-accent",
    mod: "text-amber-500 dark:text-amber-400",
    del: "text-rose-500 dark:text-rose-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      whileHover={{ y: -2 }}
    >
      <Card className="py-4 gap-2 overflow-hidden">
        <CardContent className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums truncate",
                accentClasses[accent]
              )}
            >
              {loading ? <span className="opacity-50">…</span> : value}
            </div>
            {hint ? (
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {hint}
              </div>
            ) : null}
          </div>
          {Icon ? (
            <div className="shrink-0 rounded-md border bg-muted/50 p-2">
              <Icon className={cn("size-5", accentClasses[accent])} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

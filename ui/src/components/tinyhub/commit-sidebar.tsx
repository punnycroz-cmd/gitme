"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { GitCommitHorizontal, History as HistoryIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RelativeTime } from "./relative-time";
import { DiffChips } from "./diff-chips";
import { getHistory } from "./api";
import { shortHash } from "./utils";
import { useTinyHubStore } from "./store";
import type { CommitHistoryEntry } from "./types";

interface CommitSidebarProps {
  project: string;
  refreshKey: number;
  className?: string;
}

export function CommitSidebar({ project, refreshKey, className }: CommitSidebarProps) {
  const [items, setItems] = React.useState<CommitHistoryEntry[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const setView = useTinyHubStore((s) => s.setView);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await getHistory(project, { pageSize: 8 });
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(e instanceof Error ? e.message : "Failed to load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, refreshKey]);

  return (
    <Card className="py-4 gap-3 h-full min-h-0 flex flex-col">
      <CardHeader className="pb-2 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <GitCommitHorizontal className="size-4 tinyhub-accent" />
          Recent commits
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 flex-1 min-h-0 overflow-y-auto tinyhub-scroll">
        {loading ? (
          <div className="space-y-3 px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-2 text-xs text-muted-foreground">{error}</div>
        ) : !items || items.length === 0 ? (
          <div className="px-2 text-xs text-muted-foreground">No commits yet.</div>
        ) : (
          <ul className="space-y-1">
            {items.map((c, i) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, delay: i * 0.02 }}
                className="px-2 py-2 rounded-md hover:bg-accent transition-colors cursor-default"
              >
                <div className="flex items-center gap-2 text-xs">
                  <code className="font-mono text-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                    {shortHash(c.hash)}
                  </code>
                  <span className="text-muted-foreground truncate">
                    {c.author}
                  </span>
                </div>
                <div className="mt-1 text-sm line-clamp-2">{c.message}</div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <DiffChips stats={c.stats} size="sm" />
                  <RelativeTime iso={c.date} className="text-[11px] text-muted-foreground" />
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </CardContent>
      <div className="px-4 pt-1 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => setView("history")}
        >
          <HistoryIcon className="size-3.5" />
          View full history
        </Button>
      </div>
    </Card>
  );
}

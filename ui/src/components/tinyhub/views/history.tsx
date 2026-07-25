"use client";

import * as React from "react";
import {
  GitCommitVertical,
  RefreshCw,
  Copy,
  Check,
  User,
  GitCompareArrows,
  X,
  ArrowRight,
  CalendarDays,
  Undo2,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { RelativeTime } from "../relative-time";
import { DiffChips } from "../diff-chips";
import { DiffViewer } from "../diff-viewer";
import { CompareDiffViewer } from "../compare-diff-viewer";
import { useTinyHubStore } from "../store";
import { getHistory, revertCommit, ApiError } from "../api";
import { shortHash } from "../utils";
import type { CommitHistoryEntry } from "../types";

export function History() {
  const project = useTinyHubStore((s) => s.currentProject);
  const setView = useTinyHubStore((s) => s.setView);
  const historyDateFilter = useTinyHubStore((s) => s.historyDateFilter);
  const setHistoryDateFilter = useTinyHubStore((s) => s.setHistoryDateFilter);

  const [items, setItems] = React.useState<CommitHistoryEntry[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [selected, setSelected] = React.useState<CommitHistoryEntry | null>(
    null
  );

  // Compare-mode state.
  const [compareMode, setCompareMode] = React.useState(false);
  const [compareSelection, setCompareSelection] = React.useState<
    CommitHistoryEntry[]
  >([]);
  const [compareOpen, setCompareOpen] = React.useState(false);

  React.useEffect(() => {
    if (!project) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await getHistory(project, {
          pageSize: 100,
          date: historyDateFilter || undefined,
        });
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load history");
          toast.error("Failed to load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, refreshKey, historyDateFilter]);

  // Clear selection when leaving compare mode.
  function toggleCompareMode() {
    setCompareMode((prev) => {
      const next = !prev;
      if (!next) {
        setCompareSelection([]);
        setCompareOpen(false);
      }
      return next;
    });
  }

  function handleCommitClick(c: CommitHistoryEntry) {
    if (compareMode) {
      // Toggle selection (max 2; if a third is clicked, drop the oldest).
      setCompareSelection((prev) => {
        const exists = prev.find((p) => p.hash === c.hash);
        if (exists) {
          return prev.filter((p) => p.hash !== c.hash);
        }
        if (prev.length >= 2) {
          // Replace oldest: keep the most recent selection + add the new one.
          return [prev[1], c];
        }
        return [...prev, c];
      });
      return;
    }
    setSelected(c);
  }

  function clearCompare() {
    setCompareSelection([]);
    setCompareOpen(false);
  }

  // Sort the selection so that `from` = older (smaller createdAt) and `to` = newer.
  // The history endpoint returns newest-first, but be defensive and sort by date string.
  const sortedSelection = React.useMemo(() => {
    return [...compareSelection].sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return ta - tb; // ascending: older first
    });
  }, [compareSelection]);

  const fromCommit = sortedSelection[0] ?? null;
  const toCommit = sortedSelection[1] ?? null;
  const canShowDiff = fromCommit && toCommit && fromCommit.hash !== toCommit.hash;

  if (!project) {
    return (
      <div className="bg-card border rounded-lg p-10 grid place-items-center text-center">
        <div className="space-y-3 max-w-sm">
          <div className="mx-auto grid place-items-center size-12 rounded-full bg-muted">
            <GitCommitVertical className="size-5 text-muted-foreground" />
          </div>
          <div className="font-medium">No project selected</div>
          <Button onClick={() => setView("dashboard")}>Go to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tinyhub-view-enter space-y-4 pb-24">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            History
            <Badge variant="secondary" className="text-[10px] h-5">
              {items ? items.length : "…"} commits
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project <code className="font-mono">{project}</code> — full commit
            timeline.
          </p>
          {historyDateFilter && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
              <CalendarDays className="size-3.5 tinyhub-accent" />
              <span>
                Filtered to <strong className="font-mono">{historyDateFilter}</strong>
              </span>
              <button
                type="button"
                onClick={() => setHistoryDateFilter(null)}
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear date filter"
                title="Clear date filter"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            onClick={toggleCompareMode}
            aria-pressed={compareMode}
            title={
              compareMode
                ? "Exit compare mode"
                : "Compare any two commits — click two commits to diff them."
            }
          >
            <GitCompareArrows className="size-3.5" />
            {compareMode ? "Comparing" : "Compare"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {compareMode && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
          <GitCompareArrows className="size-3.5 shrink-0 mt-0.5 tinyhub-accent" />
          <div>
            <span className="font-medium text-foreground">Compare mode:</span>{" "}
            Click two commits below to select them. The older one becomes{" "}
            <code className="font-mono">from</code>, the newer one{" "}
            <code className="font-mono">to</code>. Then open the diff with the
            bar at the bottom.
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : !items || items.length === 0 ? (
        <div className="bg-card border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No commits yet for this project.
        </div>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-2">
          {items.map((c, i) => {
            const selIdx = compareSelection.findIndex((p) => p.hash === c.hash);
            const isSelected = selIdx >= 0;
            const selectionOrder =
              isSelected && fromCommit && toCommit
                ? fromCommit.hash === c.hash
                  ? 1
                  : toCommit.hash === c.hash
                    ? 2
                    : selIdx + 1
                : selIdx + 1;
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.4) }}
                className="pl-6 relative"
              >
                <span
                  className={cn(
                    "absolute -left-[7px] top-3 size-3.5 rounded-full border-2 border-background",
                    i === 0 ? "bg-emerald-500" : "bg-foreground/70"
                  )}
                />
                <button
                  type="button"
                  onClick={() => handleCommitClick(c)}
                  aria-pressed={isSelected}
                  aria-label={
                    compareMode
                      ? isSelected
                        ? `Deselect commit ${shortHash(c.hash)} from comparison`
                        : `Select commit ${shortHash(c.hash)} for comparison`
                      : `Open commit ${shortHash(c.hash)}`
                  }
                  className={cn(
                    "w-full text-left bg-card border rounded-lg p-3 transition-all",
                    compareMode
                      ? isSelected
                        ? "border-foreground/60 ring-2 ring-foreground/15 shadow-sm"
                        : "hover:border-foreground/30 hover:shadow-sm"
                      : "hover:border-foreground/30 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      {compareMode && isSelected && (
                        <span
                          className="inline-flex items-center justify-center size-5 rounded-full bg-foreground text-background text-[10px] font-bold tabular-nums shrink-0"
                          aria-hidden="true"
                          title={
                            selectionOrder === 1
                              ? "Selected as `from` (older)"
                              : "Selected as `to` (newer)"
                          }
                        >
                          {selectionOrder}
                        </span>
                      )}
                      <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">
                        {shortHash(c.hash)}
                      </code>
                      <span className="text-sm font-medium truncate">
                        {c.message}
                      </span>
                      {i === 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 tinyhub-chip-add"
                        >
                          tip
                        </Badge>
                      )}
                    </div>
                    <RelativeTime
                      iso={c.date}
                      className="text-xs text-muted-foreground shrink-0"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="size-3" />
                      {c.author}
                    </span>
                    {c.parent && (
                      <span className="text-xs text-muted-foreground">
                        parent{" "}
                        <code className="font-mono">{shortHash(c.parent)}</code>
                      </span>
                    )}
                    <DiffChips stats={c.stats} size="sm" />
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ol>
      )}

      {/* Commit detail dialog (single-commit view) */}
      <Dialog
        open={!!selected && !compareMode}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[88vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                {selected ? shortHash(selected.hash) : ""}
              </code>
              <span className="truncate">{selected?.message}</span>
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <>
                  by {selected.author} ·{" "}
                  <RelativeTime iso={selected.date} />
                  {selected.parent && (
                    <>
                      {" "}
                      · parent{" "}
                      <code className="font-mono">
                        {shortHash(selected.parent)}
                      </code>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3 text-sm min-h-0 flex-1 overflow-y-auto tinyhub-scroll pr-1 -mr-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCell
                  label="Added"
                  value={selected.stats.added}
                  className="tinyhub-chip-add"
                />
                <StatCell
                  label="Modified"
                  value={selected.stats.modified}
                  className="tinyhub-chip-mod"
                />
                <StatCell
                  label="Deleted"
                  value={selected.stats.deleted}
                  className="tinyhub-chip-del"
                />
                <StatCell
                  label="Unchanged"
                  value={selected.stats.unchanged}
                  className="bg-muted text-muted-foreground border"
                />
              </div>

              <DiffViewer project={project} hash={selected.hash} />

              <div className="flex justify-end gap-2 pt-1">
                <CopyHashButton hash={selected.hash} />
                {selected.parent && (
                  <RevertButton
                    project={project}
                    hash={selected.hash}
                    message={selected.message}
                    onReverted={() => {
                      setSelected(null);
                      setRefreshKey((k) => k + 1);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare dialog (two-commit comparison) */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[88vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base flex-wrap">
              <GitCompareArrows className="size-4 tinyhub-accent shrink-0" />
              <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                {fromCommit ? shortHash(fromCommit.hash) : "—"}
              </code>
              <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
              <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                {toCommit ? shortHash(toCommit.hash) : "—"}
              </code>
              <span className="truncate text-muted-foreground">
                {fromCommit && toCommit
                  ? `“${fromCommit.message}” → “${toCommit.message}”`
                  : "Comparison"}
              </span>
            </DialogTitle>
            <DialogDescription>
              {fromCommit && toCommit ? (
                <>
                  Comparing {fromCommit.author} ·{" "}
                  <RelativeTime iso={fromCommit.date} /> → {toCommit.author} ·{" "}
                  <RelativeTime iso={toCommit.date} />
                </>
              ) : (
                "Select two commits to compare."
              )}
            </DialogDescription>
          </DialogHeader>

          {fromCommit && toCommit && (
            <div className="space-y-3 text-sm min-h-0 flex-1 overflow-y-auto tinyhub-scroll pr-1 -mr-1">
              <CompareDiffViewer
                project={project}
                fromHash={fromCommit.hash}
                toHash={toCommit.hash}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sticky compare bar — bottom of the history view */}
      <AnimatePresence>
        {compareMode && compareSelection.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(680px,calc(100vw-2rem))]"
            role="region"
            aria-label="Commit comparison bar"
          >
            <div className="rounded-lg border bg-card shadow-lg flex items-center gap-2 p-2 sm:p-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CompareSlot
                  label="From"
                  commit={fromCommit}
                  tone="from"
                />
                <ArrowRight className="size-4 text-muted-foreground shrink-0 hidden sm:block" />
                <CompareSlot label="To" commit={toCommit} tone="to" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCompare}
                  title="Clear selection"
                >
                  <X className="size-3.5" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCompareOpen(true)}
                  disabled={!canShowDiff}
                  title={
                    canShowDiff
                      ? "Open the diff between these two commits"
                      : compareSelection.length === 1
                        ? "Select one more commit to compare"
                        : "Select two different commits to compare"
                  }
                >
                  <GitCompareArrows className="size-3.5" />
                  Show diff
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCell({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border px-3 py-2", className)}>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80">
        {label}
      </div>
    </div>
  );
}

function CompareSlot({
  label,
  commit,
  tone,
}: {
  label: string;
  commit: CommitHistoryEntry | null;
  tone: "from" | "to";
}) {
  const toneCls =
    tone === "from"
      ? "tinyhub-chip-mod text-foreground"
      : "tinyhub-chip-add text-foreground";
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
          toneCls
        )}
      >
        {label}
      </span>
      {commit ? (
        <div className="flex items-center gap-1.5 min-w-0">
          <code
            className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted shrink-0"
            title={commit.hash}
          >
            {shortHash(commit.hash)}
          </code>
          <span className="text-xs truncate text-muted-foreground hidden md:inline">
            {commit.message}
          </span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">
          {tone === "to" ? "pick a newer commit…" : "pick a commit…"}
        </span>
      )}
    </div>
  );
}

function CopyHashButton({ hash }: { hash: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(hash);
          setCopied(true);
          toast.success("Hash copied");
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("Couldn't copy");
        }
      }}
    >
      {copied ? (
        <Check className="size-3.5 tinyhub-accent" />
      ) : (
        <Copy className="size-3.5" />
      )}
      Copy full hash
    </Button>
  );
}

function RevertButton({
  project,
  hash,
  message,
  onReverted,
}: {
  project: string;
  hash: string;
  message: string;
  onReverted: () => void;
}) {
  const [reverting, setReverting] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const handleRevert = async () => {
    setReverting(true);
    try {
      const result = await revertCommit({ proj: project, hash });
      if (result.empty) {
        toast.info(result.message || "Nothing to revert");
      } else {
        toast.success("Commit reverted", {
          description: `New commit ${result.commit?.hash} — restored ${result.restoredFiles?.length || 0} file(s), deleted ${result.deletedFiles?.length || 0}`,
        });
        if (result.missingSnapshots && result.missingSnapshots.length > 0) {
          toast.warning("Some files couldn't be restored (no historical snapshot)", {
            description: result.missingSnapshots.join(", "),
          });
        }
        onReverted();
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Revert failed";
      toast.error("Revert failed", { description: msg });
    } finally {
      setReverting(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        title={`Revert commit ${hash}`}
      >
        <Undo2 className="size-3.5" />
        Revert
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1">
      <span className="text-xs text-muted-foreground hidden sm:inline">
        Revert "{message.slice(0, 30)}{message.length > 30 ? "…" : ""}"?
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setConfirming(false)}
        disabled={reverting}
      >
        Cancel
      </Button>
      <Button
        size="sm"
        className="h-7 tinyhub-chip-del"
        onClick={handleRevert}
        disabled={reverting}
      >
        {reverting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Undo2 className="size-3.5" />
        )}
        Confirm revert
      </Button>
    </div>
  );
}

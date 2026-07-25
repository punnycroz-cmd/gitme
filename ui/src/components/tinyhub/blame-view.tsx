"use client";

import * as React from "react";
import {
  GitGraph,
  AlertCircle,
  GitCommitHorizontal,
  User,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";
import Prism from "prismjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getBlame, ApiError } from "./api";
import { DiffViewer } from "./diff-viewer";
import { RelativeTime } from "./relative-time";
import { detectLanguage, shortHash } from "./utils";
import type { BlameLine, BlameResponse } from "./types";

// Lazy-load Prism grammars for blame syntax highlighting (mirrors diff-viewer).
const LANG_LOADERS: Record<string, () => Promise<unknown>> = {
  javascript: () => import("prismjs/components/prism-javascript"),
  typescript: () => import("prismjs/components/prism-typescript"),
  jsx: () => import("prismjs/components/prism-jsx"),
  tsx: () => import("prismjs/components/prism-jsx"),
  python: () => import("prismjs/components/prism-python"),
  json: () => import("prismjs/components/prism-json"),
  markdown: () => import("prismjs/components/prism-markdown"),
  markup: () => import("prismjs/components/prism-markup"),
  css: () => import("prismjs/components/prism-css"),
  bash: () => import("prismjs/components/prism-bash"),
  sql: () => import("prismjs/components/prism-sql"),
  yaml: () => import("prismjs/components/prism-yaml"),
  go: () => import("prismjs/components/prism-go"),
  rust: () => import("prismjs/components/prism-rust"),
  java: () => import("prismjs/components/prism-java"),
  c: () => import("prismjs/components/prism-c"),
  cpp: () => import("prismjs/components/prism-cpp"),
};
const loadedLangs = new Set<string>();
async function ensureLang(lang: string): Promise<void> {
  if (lang === "text" || loadedLangs.has(lang)) return;
  const loader = LANG_LOADERS[lang];
  if (!loader) return;
  try {
    await loader();
    loadedLangs.add(lang);
  } catch {
    /* ignore */
  }
}

function renderTokenContent(
  content: string | Prism.Token | (string | Prism.Token)[],
  keyPrefix: string
): React.ReactNode {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c, i) => renderTokenContent(c, `${keyPrefix}.${i}`));
  }
  return (
    <span key={keyPrefix} className={`token ${content.type}`}>
      {renderTokenContent(content.content, `${keyPrefix}.c`)}
    </span>
  );
}

function highlightLine(text: string, lang: string): React.ReactNode {
  const grammar = Prism.languages[lang];
  if (!grammar) return text === "" ? "\u00A0" : text;
  try {
    const tokens = Prism.tokenize(text, grammar);
    return tokens.map((t, i) => {
      if (typeof t === "string") return <span key={i}>{t}</span>;
      return (
        <span key={i} className={`token ${t.type}`}>
          {renderTokenContent(t.content, `${i}.c`)}
        </span>
      );
    });
  } catch {
    return text === "" ? "\u00A0" : text;
  }
}

interface BlameViewProps {
  project: string;
  path: string;
}

/// Color cycle for commit "groups" — each distinct commit gets a tint so the
/// user can visually trace which lines belong together. Emerald/amber/rose/
/// violet/teal match the TinyHub accent palette (NO indigo/blue).
const GROUP_TINTS = [
  "border-l-emerald-500/60 bg-emerald-500/5",
  "border-l-amber-500/60 bg-amber-500/5",
  "border-l-rose-500/60 bg-rose-500/5",
  "border-l-teal-500/60 bg-teal-500/5",
  "border-l-orange-500/60 bg-orange-500/5",
];

interface BlameRow extends BlameLine {
  /** 0-based index into GROUP_TINTS for this row's commit (or -1 if no commit). */
  tintIndex: number;
  /** true when this is the first row of a consecutive group with the same commit. */
  groupStart: boolean;
  /** total # of lines in this group (for the badge). */
  groupSize: number;
}

export function BlameView({ project, path }: BlameViewProps) {
  const [data, setData] = React.useState<BlameResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Commit-diff dialog state (opened when a user clicks a blame commit ref).
  const [openHash, setOpenHash] = React.useState<string | null>(null);

  // Lazy-load the Prism grammar for this file's language.
  const lang = detectLanguage(path);
  const [langReady, setLangReady] = React.useState(lang === "text");
  React.useEffect(() => {
    let cancelled = false;
    if (lang === "text") {
      setLangReady(true);
      return;
    }
    setLangReady(false);
    (async () => {
      await ensureLang(lang);
      if (!cancelled) setLangReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  React.useEffect(() => {
    if (!project || !path) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    (async () => {
      try {
        const d = await getBlame(project, path);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof ApiError
              ? e.status === 404
                ? "File not found at tip."
                : e.message
              : e instanceof Error
                ? e.message
                : "Failed to load blame";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, path]);

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-start gap-3 text-destructive">
        <AlertCircle className="size-5 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Couldn&apos;t load blame</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Group consecutive lines blamed to the same commit into a single visual
  // block. Each distinct commit (across the file) gets a stable tint index.
  const commitTintMap = new Map<string, number>();
  let nextTint = 0;
  const rows: BlameRow[] = data.lines.map((line, i) => {
    const commitKey = line.commit ? line.commit.hash : "__none__";
    if (!commitTintMap.has(commitKey)) {
      commitTintMap.set(commitKey, nextTint++);
    }
    const tintIndex = commitTintMap.get(commitKey) ?? -1;
    // Determine if this is the start of a new group by looking ahead + behind.
    const prevLine = i > 0 ? data.lines[i - 1] : null;
    const groupStart = !prevLine ||
      (prevLine.commit?.hash ?? null) !== (line.commit?.hash ?? null);
    // Compute group size by counting forward.
    let groupSize = 1;
    for (let j = i + 1; j < data.lines.length; j++) {
      const nxt = data.lines[j];
      if ((nxt.commit?.hash ?? null) !== (line.commit?.hash ?? null)) break;
      groupSize++;
    }
    return { ...line, tintIndex, groupStart, groupSize };
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-card border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 bg-muted/30 flex-wrap">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <GitGraph className="size-4 tinyhub-accent shrink-0" />
          <span className="font-medium">Blame</span>
          <span
            className="font-mono text-xs text-muted-foreground truncate"
            title={path}
          >
            {path}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <Badge variant="outline" className="text-[10px] h-5 tabular-nums">
            {data.totalLines} {data.totalLines === 1 ? "line" : "lines"}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5 tabular-nums">
            {data.commits.length}{" "}
            {data.commits.length === 1 ? "commit" : "commits"}
          </Badge>
          {data.truncated && (
            <Badge
              variant="outline"
              className="text-[10px] h-5 tinyhub-chip-mod"
              title={`Only the first 2000 lines are shown (file has ${data.totalLines}).`}
            >
              truncated
            </Badge>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 max-h-[60vh] overflow-auto tinyhub-scroll">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            File is empty.
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-[12.5px] leading-relaxed">
            <tbody>
              {rows.map((row) => (
                <BlameRowView
                  key={row.line}
                  row={row}
                  lang={langReady ? lang : "text"}
                  onOpenCommit={(h) => setOpenHash(h)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Commit diff dialog */}
      <Dialog
        open={!!openHash}
        onOpenChange={(o) => !o && setOpenHash(null)}
      >
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[88vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitCommitHorizontal className="size-4 tinyhub-accent" />
              <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                {openHash ? shortHash(openHash) : ""}
              </code>
              <span className="truncate">Commit diff</span>
            </DialogTitle>
            <DialogDescription>
              Opened from blame for{" "}
              <code className="font-mono">{path}</code>.
            </DialogDescription>
          </DialogHeader>
          {openHash && (
            <div className="min-h-0 flex-1 overflow-y-auto tinyhub-scroll pr-1 -mr-1">
              <DiffViewer project={project} hash={openHash} />
            </div>
          )}
          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpenHash(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlameRowView({
  row,
  lang,
  onOpenCommit,
}: {
  row: BlameRow;
  lang: string;
  onOpenCommit: (hash: string) => void;
}) {
  const tint =
    row.tintIndex >= 0
      ? GROUP_TINTS[row.tintIndex % GROUP_TINTS.length]
      : "border-l-transparent";
  const commit = row.commit;

  return (
    <tr
      className={cn(
        "border-l-2 align-top",
        tint,
        // Subtle row hover for scannability.
        "hover:bg-foreground/[0.03]"
      )}
    >
      {/* Line number */}
      <td className="select-none text-right pr-2 pl-2 w-[1%] tabular-nums text-muted-foreground/50 border-r border-border/30">
        {row.line}
      </td>

      {/* Commit ref + author + time — only rendered on the first row of a
          group so consecutive same-commit lines stay visually compact. */}
      <td className="pl-2 pr-2 w-[1%] whitespace-nowrap align-top">
        {row.groupStart ? (
          commit ? (
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onOpenCommit(commit.hash)}
                    className="inline-flex items-center gap-1 rounded bg-muted hover:bg-foreground/10 px-1.5 py-0.5 text-[11px] transition-colors"
                    aria-label={`Open commit ${shortHash(commit.hash)} diff`}
                    title={`Open commit ${commit.hash}`}
                  >
                    <GitCommitHorizontal className="size-3 tinyhub-accent" />
                    <span className="font-mono">{shortHash(commit.hash)}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <User className="size-3" />
                      <span>{commit.author}</span>
                    </div>
                    <div className="font-mono text-[11px] opacity-80">
                      {commit.hash}
                    </div>
                    <div className="line-clamp-2">{commit.message}</div>
                    <div className="opacity-70">
                      <RelativeTime
                        ms={commit.createdAt}
                        withTooltip={false}
                      />
                    </div>
                    <div className="opacity-70">
                      {row.groupSize > 1
                        ? `${row.groupSize} consecutive lines`
                        : "1 line"}
                    </div>
                    <div className="opacity-70 text-[10px]">Click to open diff</div>
                  </div>
                </TooltipContent>
              </Tooltip>
              <div className="hidden sm:flex flex-col text-[10px] text-muted-foreground leading-tight min-w-0">
                <span className="truncate max-w-[140px]" title={commit.author}>
                  {commit.author}
                </span>
                <span className="tabular-nums">
                  <RelativeTime ms={commit.createdAt} withTooltip={false} />
                </span>
              </div>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground italic">
                  <Info className="size-3" />
                  unknown
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">
                <div className="text-xs">
                  This line could not be attributed to a specific commit
                  (pre-snapshot history or unmatched line).
                </div>
              </TooltipContent>
            </Tooltip>
          )
        ) : (
          // Continuation row — show muted group-size pip so the user can see
          // the group is still in progress without re-rendering commit info.
          <span className="inline-block text-[10px] text-muted-foreground/40 select-none">
            {row.groupSize > 1 && row.groupStart === false ? "↳" : ""}
          </span>
        )}
      </td>

      {/* Code content */}
      <td className="pl-2 pr-3 whitespace-pre-wrap break-all tinyhub-diff-code">
        {highlightLine(row.content, lang)}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading + empty exports (kept for future use / parity with other views).

export function BlameSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-2"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </motion.div>
  );
}

"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  FilePenLine,
  FileX2,
  ExternalLink,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";
import Prism from "prismjs";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { getCommitDiff, ApiError } from "./api";
import { useTinyHubStore } from "./store";
import { detectLanguage, formatBytes } from "./utils";
import { RelativeTime } from "./relative-time";
import type { CommitDiffFile, CommitDiffResponse } from "./types";

const MAX_LINES_PER_FILE = 500;

// Register the Prism languages we support in diffs (matches file-viewer set).
// Lazy-imported to avoid bundling all languages.
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
    /* ignore — fall back to plain text */
  }
}

/// Recursively render a Prism token's content (which may be a string, a single
/// PrismToken, or an array of either) into React nodes.
function renderTokenContent(
  content: string | Prism.Token | (string | Prism.Token)[],
  keyPrefix: string
): React.ReactNode {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c, i) => renderTokenContent(c, `${keyPrefix}.${i}`));
  }
  // It's a nested Prism.Token.
  return (
    <span key={keyPrefix} className={`token ${content.type}`}>
      {renderTokenContent(content.content, `${keyPrefix}.c`)}
    </span>
  );
}

/// Tokenize a single line of code with Prism and return React spans with
/// token-class coloring. Falls back to plain text if Prism has no grammar.
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

interface DiffViewerProps {
  project: string;
  hash: string;
}

export function DiffViewer({ project, hash }: DiffViewerProps) {
  const [data, setData] = React.useState<CommitDiffResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!project || !hash) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    (async () => {
      try {
        const d = await getCommitDiff(project, hash);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof ApiError
              ? e.status === 404
                ? "Commit not found."
                : e.message
              : e instanceof Error
                ? e.message
                : "Failed to load diff";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, hash]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Couldn&apos;t load diff</div>
          <div className="text-xs opacity-90">{error}</div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* Note / limitation alert */}
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0 mt-0.5 tinyhub-accent" />
        <div>
          <span className="font-medium text-foreground">Diff scope:</span>{" "}
          {data.note}
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <DiffStatBadge kind="added" count={data.stats.added} />
        <DiffStatBadge kind="modified" count={data.stats.modified} />
        <DiffStatBadge kind="deleted" count={data.stats.deleted} />
        <span className="text-muted-foreground">
          · {data.files.length} file{data.files.length === 1 ? "" : "s"}
        </span>
        {data.isTip ? (
          <Badge
            variant="outline"
            className="tinyhub-chip-add text-[10px] h-5 gap-1"
          >
            <CheckCircle2 className="size-3" />
            tip
          </Badge>
        ) : null}
        <span className="ml-auto text-muted-foreground">
          <RelativeTime iso={new Date(data.createdAt).toISOString()} />
        </span>
      </div>

      {/* File list */}
      {data.files.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No file changes recorded for this commit.
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.files.map((f, i) => (
            <motion.div
              key={`${f.path}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, delay: Math.min(i * 0.02, 0.3) }}
            >
              <FileDiffCard file={f} project={project} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type DiffLineKind = "add" | "del" | "ctx";

interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** line number in the after-content (1-based) for add/ctx, null for del */
  afterNo: number | null;
  /** line number in the before-content (1-based) for del/ctx, null for add */
  beforeNo: number | null;
}

/**
 * Classic LCS line-diff. O(N*M) DP — capped upstream so it stays fast.
 * Returns a unified list of add/del/ctx lines.
 */
function computeDiff(before: string, after: string): DiffLine[] {
  const a = before.length ? before.split("\n") : [];
  const b = after.length ? after.split("\n") : [];
  // Trim a trailing empty string that comes from a final newline so line
  // counts read naturally.
  if (a.length > 1 && a[a.length - 1] === "") a.pop();
  if (b.length > 1 && b[b.length - 1] === "") b.pop();

  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i..] & b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let beforeNo = 1;
  let afterNo = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "ctx", text: a[i], afterNo, beforeNo });
      i++;
      j++;
      beforeNo++;
      afterNo++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: a[i], afterNo: null, beforeNo });
      i++;
      beforeNo++;
    } else {
      out.push({ kind: "add", text: b[j], afterNo, beforeNo: null });
      j++;
      afterNo++;
    }
  }
  while (i < n) {
    out.push({ kind: "del", text: a[i], afterNo: null, beforeNo });
    i++;
    beforeNo++;
  }
  while (j < m) {
    out.push({ kind: "add", text: b[j], afterNo, beforeNo: null });
    j++;
    afterNo++;
  }
  return out;
}

/** Build a diff where every after-line is shown as "added" (used when before is unavailable). */
function allAdded(after: string): DiffLine[] {
  const b = after.length ? after.split("\n") : [];
  if (b.length > 1 && b[b.length - 1] === "") b.pop();
  return b.map((text, idx) => ({
    kind: "add" as const,
    text,
    afterNo: idx + 1,
    beforeNo: null,
  }));
}

/** Build a diff where every before-line is shown as "removed" (deleted files). */
function allRemoved(before: string): DiffLine[] {
  const a = before.length ? before.split("\n") : [];
  if (a.length > 1 && a[a.length - 1] === "") a.pop();
  return a.map((text, idx) => ({
    kind: "del" as const,
    text,
    afterNo: null,
    beforeNo: idx + 1,
  }));
}

function FileDiffCard({
  file,
  project,
}: {
  file: CommitDiffFile;
  project: string;
}) {
  const openFile = useTinyHubStore((s) => s.openFile);
  const lang = detectLanguage(file.path);
  const [langReady, setLangReady] = React.useState(lang === "text");

  // Lazily load the Prism grammar for this file's language.
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

  let lines: DiffLine[];
  let truncated = false;
  let noteForModified = false;
  let hasRemovedContent = false;

  if (file.changeType === "deleted") {
    // v2: if we have the before content (ancestor snapshot), show it as removed lines.
    if (file.before !== null) {
      const all = allRemoved(file.before);
      if (all.length > MAX_LINES_PER_FILE) {
        lines = all.slice(0, MAX_LINES_PER_FILE);
        truncated = true;
      } else {
        lines = all;
      }
      hasRemovedContent = true;
    } else {
      lines = [];
    }
  } else if (file.after === null) {
    lines = [];
  } else if (file.before !== null) {
    const all = computeDiff(file.before, file.after);
    if (all.length > MAX_LINES_PER_FILE) {
      lines = all.slice(0, MAX_LINES_PER_FILE);
      truncated = true;
    } else {
      lines = all;
    }
  } else {
    // before is null (v1 limitation). For modified, show a note before the
    // content; for added, just render all lines as added.
    noteForModified = file.changeType === "modified";
    const all = allAdded(file.after);
    if (all.length > MAX_LINES_PER_FILE) {
      lines = all.slice(0, MAX_LINES_PER_FILE);
      truncated = true;
    } else {
      lines = all;
    }
  }

  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 flex-wrap">
        <ChangeTypeBadge changeType={file.changeType} />
        <button
          type="button"
          onClick={() => openFile(project, file.path)}
          className="font-mono text-xs truncate hover:underline text-left min-w-0 max-w-full"
          title={`Open ${file.path} in browser`}
        >
          <span
            className={cn(
              file.changeType === "deleted" && "line-through text-muted-foreground"
            )}
          >
            {file.path}
          </span>
        </button>
        <ExternalLink className="size-3 text-muted-foreground shrink-0" />
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {file.changeType === "deleted"
            ? "removed"
            : `${formatBytes(file.size)} · ${added}+ · ${removed}-`}
        </span>
      </div>

      {/* Body */}
      {file.changeType === "deleted" && !hasRemovedContent ? (
        <div className="px-3 py-3 text-xs font-mono text-muted-foreground italic">
          {"// File removed"}
        </div>
      ) : file.after === null && !hasRemovedContent ? (
        <div className="px-3 py-3 text-xs font-mono text-muted-foreground italic">
          {"// File removed"}
        </div>
      ) : (
        <>
          {noteForModified && (
            <div className="px-3 py-1.5 text-[11px] tinyhub-chip-mod border-b">
              Historical before-content not stored; showing current content.
            </div>
          )}
          <DiffLines lines={lines} lang={langReady ? lang : "text"} />
          {truncated && (
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t bg-muted/20">
              … {MAX_LINES_PER_FILE} lines shown — further lines truncated.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DiffLines({
  lines,
  lang,
}: {
  lines: DiffLine[];
  lang: string;
}) {
  if (lines.length === 0) {
    return <div className="px-3 py-3 text-xs text-muted-foreground">empty</div>;
  }
  // Render rows in a table so the gutter / sign / text columns stay aligned.
  return (
    <div className="max-h-[50vh] overflow-auto tinyhub-scroll font-mono text-[12.5px] leading-relaxed">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((l, idx) => (
            <DiffRow key={idx} line={l} lang={lang} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffRow({ line, lang }: { line: DiffLine; lang: string }) {
  const sign = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
  return (
    <tr
      data-line-type={line.kind}
      className={cn(
        line.kind === "add" && "tinyhub-diff-add",
        line.kind === "del" && "tinyhub-diff-del",
        line.kind === "ctx" && "tinyhub-diff-ctx"
      )}
    >
      <td className="select-none text-right pr-2 pl-2 align-top w-[1%] tabular-nums text-muted-foreground/60 border-r border-border/40">
        {line.beforeNo ?? ""}
      </td>
      <td className="select-none text-right pr-2 pl-2 align-top w-[1%] tabular-nums text-muted-foreground/60 border-r border-border/40">
        {line.afterNo ?? ""}
      </td>
      <td className="select-none pl-2 pr-1 align-top w-[1%] text-muted-foreground/70">
        {sign}
      </td>
      <td className="pl-1 pr-3 align-top whitespace-pre-wrap break-all tinyhub-diff-code">
        {highlightLine(line.text, lang)}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ChangeTypeBadge({
  changeType,
}: {
  changeType: CommitDiffFile["changeType"];
}) {
  if (changeType === "added") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md tinyhub-chip-add px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0">
        <FilePlus2 className="size-3" />
        added
      </span>
    );
  }
  if (changeType === "modified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md tinyhub-chip-mod px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0">
        <FilePenLine className="size-3" />
        modified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md tinyhub-chip-del px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0">
      <FileX2 className="size-3" />
      deleted
    </span>
  );
}

function DiffStatBadge({
  kind,
  count,
}: {
  kind: "added" | "modified" | "deleted";
  count: number;
}) {
  const cls =
    kind === "added"
      ? "tinyhub-chip-add"
      : kind === "modified"
        ? "tinyhub-chip-mod"
        : "tinyhub-chip-del";
  const label = kind === "added" ? "added" : kind === "modified" ? "modified" : "deleted";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium tabular-nums",
        cls,
        count === 0 && "opacity-40"
      )}
    >
      {count} {label}
    </span>
  );
}

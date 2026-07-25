"use client";

import * as React from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  javascript,
  typescript,
  jsx,
  tsx,
  python,
  json,
  markdown,
  markup,
  css,
  bash,
  sql,
  yaml,
  go,
  rust,
  java,
  c,
  cpp,
} from "react-syntax-highlighter/dist/esm/languages/prism";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  AlertCircle,
  Pencil,
  X,
  Loader2,
  Save,
  GitCommitHorizontal,
  GitGraph,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fileUrl, getFileText, commitProject, ApiError } from "./api";
import {
  detectLanguage,
  fileExt,
  fileBaseName,
  isImageFile,
  formatBytes,
} from "./utils";
import { useTinyHubStore } from "./store";
import { BlameView } from "./blame-view";
import { MarkdownRenderer } from "./markdown-renderer";

// Register languages once.
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("markup", markup);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("go", go);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("c", c);
SyntaxHighlighter.registerLanguage("cpp", cpp);

const NO_LANG = ["text", ""];

interface FileViewerProps {
  path: string;
  project: string;
  /** Called after a successful in-browser edit commit (so callers can refresh tree/sidebar). */
  onCommitted?: () => void;
}

export function FileViewer({ path, project, onCommitted }: FileViewerProps) {
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const { resolvedTheme } = useTheme();

  // Edit-mode state
  const [editMode, setEditMode] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [commitMessage, setCommitMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Blame mode (mutually exclusive with edit mode — both replace the content pane).
  const [showBlame, setShowBlame] = React.useState(false);

  const setPath = useTinyHubStore((s) => s.setPath);

  // Refs mirroring state so the path-change guard (inside the load effect)
  // can read the latest values without re-running on every keystroke.
  const editModeRef = React.useRef(editMode);
  const draftRef = React.useRef(draft);
  const contentRef = React.useRef(content);
  const prevPathRef = React.useRef<string>(path);
  React.useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);
  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  React.useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const dirty = editMode && content !== null && draft !== content;

  // beforeunload guard — prevents accidental tab close / refresh while dirty.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  React.useEffect(() => {
    let cancelled = false;

    // In-app navigation guard: if the path is changing while we're editing
    // with unsaved changes, prompt before discarding.
    if (prevPathRef.current !== path) {
      const wasEditing =
        editModeRef.current &&
        contentRef.current !== null &&
        draftRef.current !== contentRef.current;
      if (wasEditing) {
        const ok = window.confirm(
          `Discard unsaved changes to ${prevPathRef.current}?`
        );
        if (!ok) {
          // Revert the path — the store change has already happened.
          setPath(prevPathRef.current);
          return;
        }
      }
      prevPathRef.current = path;
      // Exit edit mode whenever the file actually changes.
      setEditMode(false);
      setDraft("");
      setCommitMessage("");
      // Reset blame view so it re-loads for the new file.
      setShowBlame(false);
    }

    setLoading(true);
    setError(null);
    setContent(null);
    (async () => {
      try {
        if (isImageFile(path)) {
          setContent(null); // images render via <img>
        } else {
          const text = await getFileText(project, path);
          if (!cancelled) setContent(text);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, path, setPath]);

  const lang = detectLanguage(path);
  const isImage = isImageFile(path);
  const isMarkdown = ["md", "markdown"].includes(fileExt(path));
  const isDark = resolvedTheme === "dark";
  const ext = fileExt(path);

  const handleCopy = async () => {
    if (content === null) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = fileUrl(project, path);
    a.download = fileBaseName(path);
    a.click();
  };

  const enterEdit = () => {
    if (content === null) return;
    setDraft(content);
    setCommitMessage(`Update ${fileBaseName(path)}`);
    setEditMode(true);
    // Edit and blame are mutually exclusive.
    setShowBlame(false);
  };

  const toggleBlame = () => {
    if (editMode) return; // never allow blame while editing
    setShowBlame((v) => !v);
  };

  const exitEdit = (opts?: { confirm?: boolean }) => {
    if (opts?.confirm && dirty) {
      const ok = window.confirm(
        "Discard unsaved changes? Your edits will be lost."
      );
      if (!ok) return;
    }
    setEditMode(false);
    setDraft("");
    setCommitMessage("");
    setSubmitting(false);
  };

  const handleSave = async () => {
    if (submitting) return;
    if (content === null) return;
    if (draft === content) {
      toast.info("No changes to save");
      return;
    }
    const message = commitMessage.trim() || `Update ${fileBaseName(path)}`;
    setSubmitting(true);
    try {
      const result = await commitProject({
        proj: project,
        message,
        files: { [path]: draft },
      });
      if (result.empty) {
        toast.info("No changes — file content is identical.");
        return;
      }
      toast.success(
        `Committed ${result.commit.hash.slice(0, 8)} · +${result.stats.added} ~${result.stats.modified} -${result.stats.deleted}`
      );
      // Update local content so the viewer reflects the saved state.
      setContent(draft);
      setEditMode(false);
      setCommitMessage("");
      onCommitted?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as
          | { message?: string; remoteTip?: string; yourTip?: string }
          | undefined;
        toast.error(
          body?.message ||
            "Remote has newer commits — refresh and retry your edit."
        );
      } else {
        const msg =
          e instanceof Error ? e.message : "Failed to commit changes";
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTextareaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter → Save
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSave();
      return;
    }
    // Escape → exit (with confirm if dirty)
    if (e.key === "Escape") {
      e.preventDefault();
      exitEdit({ confirm: true });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 bg-muted/30">
        <div className="min-w-0 flex items-center gap-2 text-sm">
          <span className="font-mono truncate" title={path}>
            {fileBaseName(path)}
          </span>
          <span className="text-xs uppercase text-muted-foreground">
            {ext || "file"}
          </span>
          {editMode && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                dirty ? "tinyhub-chip-mod" : "bg-muted text-muted-foreground border"
              )}
            >
              <Pencil className="size-3" />
              {dirty ? "modified" : "editing"}
            </span>
          )}
          {showBlame && !editMode && (
            <span className="inline-flex items-center gap-1 rounded-md tinyhub-chip-add px-1.5 py-0.5 text-[10px] font-medium">
              <GitGraph className="size-3" />
              blame
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editMode ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => exitEdit({ confirm: true })}
              disabled={submitting}
              title="Exit edit mode (Esc)"
              aria-label="Cancel edit"
            >
              <X className="size-3.5" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8"
                title="Open raw file in a new tab"
              >
                <a href={fileUrl(project, path)} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  <span className="hidden sm:inline">Raw</span>
                </a>
              </Button>
              {!isImage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={handleDownload}
                  title="Download file"
                  aria-label="Download file"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}
              {!isImage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={handleCopy}
                  disabled={content === null}
                  title="Copy content to clipboard"
                  aria-label="Copy content"
                >
                  {copied ? (
                    <Check className="size-3.5 tinyhub-accent" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {copied ? "Copied" : "Copy"}
                  </span>
                </Button>
              )}
              {!isImage && (
                <Button
                  variant={showBlame ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                  onClick={toggleBlame}
                  disabled={content === null || loading}
                  title={showBlame ? "Hide blame" : "Show per-line blame (which commit last touched each line)"}
                  aria-label={showBlame ? "Hide blame" : "Show blame"}
                  aria-pressed={showBlame}
                >
                  <GitGraph className="size-3.5" />
                  <span className="hidden sm:inline">Blame</span>
                </Button>
              )}
              {!isImage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={enterEdit}
                  disabled={content === null || loading}
                  title="Edit this file and commit changes"
                  aria-label="Edit file"
                >
                  <Pencil className="size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto tinyhub-scroll">
        {loading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : error ? (
          <div className="p-6 flex items-center gap-3 text-destructive">
            <AlertCircle className="size-5" />
            <div>
              <div className="font-medium">Failed to load file</div>
              <div className="text-sm text-muted-foreground">{error}</div>
            </div>
          </div>
        ) : isImage ? (
          <div className="p-6 flex items-center justify-center min-h-[200px]">
            <img
              src={fileUrl(project, path)}
              alt={path}
              className="max-w-full max-h-[70vh] rounded border shadow-sm"
            />
          </div>
        ) : editMode ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleTextareaKey}
            spellCheck={false}
            aria-label={`Editing ${path}`}
            className="tinyhub-editor-textarea w-full h-full resize-none bg-transparent p-3 text-[13px] leading-relaxed outline-none tinyhub-scroll"
            style={{
              fontFamily:
                "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
              tabSize: 2,
            }}
          />
        ) : showBlame ? (
          <BlameView project={project} path={path} />
        ) : isMarkdown && content !== null ? (
          <MarkdownRenderer content={content} path={path} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="text-sm"
          >
            <SyntaxHighlighter
              language={NO_LANG.includes(lang) ? "text" : lang}
              style={isDark ? oneDark : oneLight}
              showLineNumbers
              wrapLongLines={false}
              customStyle={{
                margin: 0,
                background: "transparent",
                padding: "12px 14px",
                fontSize: "13px",
                fontFamily:
                  "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
              }}
              lineNumberStyle={{
                minWidth: "2.5em",
                paddingRight: "1em",
                color: "var(--muted-foreground)",
                userSelect: "none",
                opacity: 0.6,
              }}
              codeTagProps={{
                style: {
                  fontFamily:
                    "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
                },
              }}
            >
              {content ?? ""}
            </SyntaxHighlighter>
          </motion.div>
        )}
      </div>

      {/* Footer status / edit action bar */}
      {editMode && !loading && !error && !isImage ? (
        <div className="border-t px-3 py-2 bg-muted/30 space-y-2">
          <div className="flex items-start gap-2">
            <GitCommitHorizontal className="size-4 text-muted-foreground shrink-0 mt-1.5" />
            <Textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={`Update ${fileBaseName(path)}\n\nOptional extended description…`}
              disabled={submitting}
              className="text-xs flex-1 min-w-[160px] min-h-[44px] max-h-[120px] resize-y leading-relaxed"
              aria-label="Commit message"
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {dirty
                ? `${formatBytes(new Blob([draft]).size)} · ${draft.split("\n").length} lines`
                : "no changes"}
            </span>
            <div className="flex items-center gap-2">
              {dirty && (
                <span className="text-[10px] tinyhub-chip-mod rounded px-1.5 py-0.5">
                  modified
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setEditMode(false);
                  setDraft(content ?? "");
                }}
                disabled={submitting}
                title="Cancel edit (Esc)"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8"
                onClick={handleSave}
                disabled={submitting || !dirty}
                title="Commit changes (⌘/Ctrl + Enter)"
              >
                {submitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span>Save changes</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground bg-muted/20">
          <span className="font-mono truncate">{path}</span>
          {content !== null && !loading && (
            <span className="tabular-nums shrink-0">
              {formatBytes(new Blob([content]).size)} ·{" "}
              {content.split("\n").length} lines
            </span>
          )}
          {isImage && !loading && (
            <span className="shrink-0">image · {ext}</span>
          )}
        </div>
      )}
    </div>
  );
}

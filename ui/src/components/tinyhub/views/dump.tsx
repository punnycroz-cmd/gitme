"use client";

import * as React from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
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
} from "react-syntax-highlighter/dist/esm/languages/prism";
import {
  Download,
  Copy,
  Check,
  RefreshCw,
  FileCode2,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileWarning,
  Eye,
  Code2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { useTinyHubStore } from "../store";
import {
  ApiError,
  buildDumpText,
  getDumpHtmlUrl,
  getDumpJson,
} from "../api";
import { detectLanguage, fileBaseName, formatBytes, formatNumber } from "../utils";
import type { DumpJsonResponse } from "../types";

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

type DumpMode = "full" | "delta" | "summary";
type RenderFormat = "rendered" | "json";

export function Dump() {
  const project = useTinyHubStore((s) => s.currentProject);
  const setView = useTinyHubStore((s) => s.setView);
  const { resolvedTheme } = useTheme();

  const [mode, setMode] = React.useState<DumpMode>("full");
  const [since, setSince] = React.useState("");
  const [maxTokens, setMaxTokens] = React.useState("");
  const [pathFilter, setPathFilter] = React.useState("");
  const [format, setFormat] = React.useState<RenderFormat>("rendered");

  const [dump, setDump] = React.useState<DumpJsonResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [skippedOpen, setSkippedOpen] = React.useState(false);

  const fetchDump = React.useCallback(async () => {
    if (!project) return;
    setLoading(true);
    setError(null);
    setDump(null);
    try {
      const data = await getDumpJson(project, {
        mode,
        since: since || undefined,
        max_tokens: maxTokens ? Number(maxTokens) : undefined,
        path: pathFilter || undefined,
        format: "json",
      });
      setDump(data);
    } catch (e) {
      const msg =
        e instanceof ApiError || e instanceof Error
          ? e.message
          : "Failed to load dump";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [project, mode, since, maxTokens, pathFilter]);

  // Fetch on mount and when project changes.
  React.useEffect(() => {
    fetchDump();
  }, [fetchDump, project]);

  if (!project) {
    return (
      <div className="bg-card border rounded-lg p-10 grid place-items-center text-center">
        <div className="space-y-3 max-w-sm">
          <div className="mx-auto grid place-items-center size-12 rounded-full bg-muted">
            <Download className="size-5 text-muted-foreground" />
          </div>
          <div className="font-medium">No project selected</div>
          <Button onClick={() => setView("dashboard")}>Go to dashboard</Button>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    if (!dump) return;
    try {
      await navigator.clipboard.writeText(buildDumpText(dump));
      setCopied(true);
      toast.success("Dump copied to clipboard");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const handleDownload = () => {
    if (!dump) return;
    const text = buildDumpText(dump);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project}-dump-${mode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileCount = dump
    ? Array.isArray(dump.files)
      ? dump.files.length
      : Object.keys(dump.files || {}).length
    : 0;
  const skippedCount = dump?.skipped?.length || 0;
  const isDark = resolvedTheme === "dark";

  return (
    <div className="tinyhub-view-enter space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            Dump
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshot of <code className="font-mono">{project}</code> as a single
            text bundle. Perfect for handing off to an LLM or generating a
            code-review pack.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDump} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Controls bar */}
      <Card className="py-4">
        <CardContent className="px-4 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="dump-mode" className="text-xs">Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as DumpMode)}
            >
              <SelectTrigger id="dump-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">full</SelectItem>
                <SelectItem value="delta">delta</SelectItem>
                <SelectItem value="summary">summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dump-since" className="text-xs">Since (hash or "last")</Label>
            <Input
              id="dump-since"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              placeholder="last"
              className="font-mono h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dump-max" className="text-xs">Max tokens</Label>
            <Input
              id="dump-max"
              type="number"
              min={0}
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="auto"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dump-path" className="text-xs">Path filter</Label>
            <Input
              id="dump-path"
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
              placeholder="src/"
              className="font-mono h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                value={format}
                onValueChange={(v) => v && setFormat(v as RenderFormat)}
                className="border rounded-md h-9 px-1"
              >
                <ToggleGroupItem value="rendered" className="h-7 gap-1 text-xs">
                  <Eye className="size-3.5" /> Rendered
                </ToggleGroupItem>
                <ToggleGroupItem value="json" className="h-7 gap-1 text-xs">
                  <Code2 className="size-3.5" /> JSON
                </ToggleGroupItem>
              </ToggleGroup>
              <Button size="sm" onClick={fetchDump} disabled={loading} className="h-9 flex-1">
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Go
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats + actions */}
      {dump && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px] h-5">
            {formatNumber(fileCount)} files
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5">
            commit {dump.commit?.slice(0, 8) || "none"}
          </Badge>
          {dump.createdAt ? (
            <span>
              created {new Date(dump.createdAt).toLocaleString()}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy} disabled={loading}>
              {copied ? (
                <Check className="size-3.5 tinyhub-accent" />
              ) : (
                <Copy className="size-3.5" />
              )}
              Copy all
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={loading}>
              <Download className="size-3.5" />
              Download .txt
            </Button>
            <Button
              size="sm"
              variant="ghost"
              asChild
            >
              <a
                href={getDumpHtmlUrl(project, {
                  mode,
                  since: since || undefined,
                  max_tokens: maxTokens ? Number(maxTokens) : undefined,
                  path: pathFilter || undefined,
                  format: "html",
                })}
                target="_blank"
                rel="noreferrer"
              >
                Open HTML
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="py-4 border-destructive/40">
          <CardContent className="px-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && !dump && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-5 w-1/3 bg-muted rounded animate-pulse" />
              <div className="h-20 w-full bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {dump && (
        <div className="space-y-4">
          {/* Skipped files panel */}
          {skippedCount > 0 && (
            <Collapsible open={skippedOpen} onOpenChange={setSkippedOpen}>
              <Card className="py-3 border-amber-500/40 bg-amber-500/5">
                <CollapsibleTrigger asChild>
                  <CardHeader className="px-4 pb-2 flex-row items-center justify-between cursor-pointer">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileWarning className="size-4 text-amber-500" />
                      Skipped files
                      <Badge variant="outline" className="text-[10px] h-5 tinyhub-chip-mod">
                        {skippedCount}
                      </Badge>
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="h-7">
                      {skippedOpen ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                    </Button>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="px-4">
                    <ul className="max-h-72 overflow-y-auto tinyhub-scroll divide-y text-sm">
                      {dump.skipped.map((s, i) => (
                        <li
                          key={`${s.path}-${i}`}
                          className="py-1.5 flex items-center gap-3"
                        >
                          <FileWarning className="size-3.5 text-amber-500 shrink-0" />
                          <code className="font-mono text-xs truncate flex-1">
                            {s.path}
                          </code>
                          <span className="text-xs text-muted-foreground">
                            {s.reason}
                            {typeof s.size === "number"
                              ? ` · ${formatBytes(s.size)}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Rendered format */}
          {format === "rendered" ? (
            fileCount === 0 ? (
              <Card className="py-10">
                <CardContent className="px-4 text-center text-sm text-muted-foreground">
                  No files in this dump. Adjust the mode/path filter and try
                  again.
                </CardContent>
              </Card>
            ) : Array.isArray(dump.files) ? (
              <Card className="py-4">
                <CardHeader className="px-4 pb-2">
                  <CardTitle className="text-sm font-medium">Project Summary ({dump.files.length} files)</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <div className="divide-y text-xs font-mono">
                    {(dump.files as any[]).map((f) => (
                      <div key={f.path} className="py-2 flex items-center justify-between gap-3">
                        <span className="truncate">{f.path}</span>
                        <div className="flex items-center gap-4 text-muted-foreground shrink-0 tabular-nums">
                          <span>{formatBytes(f.size || 0)}</span>
                          {f.sha256 && <span className="text-[10px] hidden sm:inline text-muted-foreground/70">{f.sha256.slice(0, 12)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {Object.entries(dump.files).map(([path, content], i) => (
                  <FileSection
                    key={path}
                    path={path}
                    content={content}
                    isDark={isDark}
                    delay={Math.min(i * 0.01, 0.3)}
                  />
                ))}
              </div>
            )
          ) : (
            <Card className="py-4">
              <CardHeader className="px-4 pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm">Raw JSON</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        JSON.stringify(dump, null, 2)
                      );
                      toast.success("JSON copied");
                    } catch {
                      toast.error("Couldn't copy");
                    }
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent className="px-4">
                <pre className="max-h-[60vh] overflow-auto tinyhub-scroll rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre">
                  {JSON.stringify(dump, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function FileSection({
  path,
  content,
  isDark,
  delay,
}: {
  path: string;
  content: string;
  isDark: boolean;
  delay: number;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const lang = detectLanguage(path);
  const lineCount = content ? content.split("\n").length : 0;
  const byteSize = content ? new Blob([content]).size : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay }}
      className="bg-card border rounded-lg overflow-hidden"
      style={{ contentVisibility: "auto", containIntrinsicSize: "200px" }}
    >
      <div
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between gap-2 border-b px-3 py-1.5 bg-muted/30 hover:bg-muted/50 cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 text-xs font-medium">
          {collapsed ? (
            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <FileCode2 className="size-3.5 text-muted-foreground shrink-0" />
          <code className="font-mono truncate" title={path}>
            {path}
          </code>
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {fileBaseName(path).split(".").pop()?.toUpperCase()} ·{" "}
          {formatBytes(byteSize)} · {lineCount} lines
        </div>
      </div>
      {!collapsed && (
        lineCount > 300 ? (
          <pre className="p-3 text-[12.5px] font-mono overflow-x-auto whitespace-pre bg-transparent border-none text-foreground/90">
            {content || ""}
          </pre>
        ) : (
          <SyntaxHighlighter
            language={lang || "text"}
            style={isDark ? oneDark : oneLight}
            showLineNumbers
            wrapLongLines={false}
            customStyle={{
              margin: 0,
              background: "transparent",
              padding: "10px 14px",
              fontSize: "12.5px",
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
            {content || ""}
          </SyntaxHighlighter>
        )
      )}
    </motion.div>
  );
}

"use client";

import * as React from "react";
import { lazy, Suspense } from "react";
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
  ChevronsUpDown,
  ChevronsDownUp,
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
import { DumpHeader } from "../DumpHeader";
import {
  ApiError,
  buildDumpText,
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
  const [allCollapsed, setAllCollapsed] = React.useState(false);

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

  const filesObject = dump?.files || {};
  const isFilesArray = Array.isArray(filesObject);
  const filesArray: [string, string][] = isFilesArray
    ? (filesObject as any[]).map((f) => [f.path, f.sha256 || ""])
    : Object.entries(filesObject as Record<string, string>);

  const fileCount = dump
    ? isFilesArray
      ? (filesObject as any[]).length
      : Object.keys(filesObject).length
    : 0;

  const skippedCount = dump?.skipped?.length || 0;
  const isDark = resolvedTheme === "dark";

  return (
    <div className="tinyhub-view-enter space-y-4">
      <DumpHeader
        project={project}
        loading={loading}
        fetchDump={fetchDump}
      />

      {/* Controls bar */}
      <Card className="py-4">
        <CardContent className="px-4 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="dump-mode" className="text-xs">
              Mode
            </Label>
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
            <Label htmlFor="dump-since" className="text-xs">
              Since (hash or "last")
            </Label>
            <Input
              id="dump-since"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              placeholder="last"
              className="font-mono h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dump-max" className="text-xs">
              Max tokens
            </Label>
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
            <Label htmlFor="dump-path" className="text-xs">
              Path filter
            </Label>
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
              <Button
                size="sm"
                onClick={fetchDump}
                disabled={loading}
                className="h-9 flex-1"
              >
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
          <Badge variant="outline" className="text-[10px] h-5 font-mono">
            commit {dump.commit?.slice(0, 8) || "none"}
          </Badge>
          {dump.createdAt ? (
            <span>created {new Date(dump.createdAt).toLocaleString()}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {format === "rendered" && !isFilesArray && fileCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAllCollapsed((c) => !c)}
                className="h-8 text-xs gap-1.5"
              >
                {allCollapsed ? (
                  <>
                    <ChevronsUpDown className="size-3.5" /> Expand all
                  </>
                ) : (
                  <>
                    <ChevronsDownUp className="size-3.5" /> Collapse all
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              disabled={loading}
              className="h-8 text-xs gap-1.5"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
              Copy all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={loading}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="size-3.5" />
              Download .txt
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="py-4 border-destructive/40 bg-destructive/5">
          <CardContent className="px-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && !dump && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2">
              <div className="h-4 w-1/4 bg-muted rounded animate-pulse" />
              <div className="h-24 w-full bg-muted/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Body Content */}
      {dump && !loading && (
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
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 border-amber-500/40"
                      >
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
                    <ul className="max-h-72 overflow-y-auto divide-y text-sm">
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

          {/* Rendered View Format */}
          {format === "rendered" ? (
            fileCount === 0 ? (
              <Card className="py-10">
                <CardContent className="px-4 text-center text-sm text-muted-foreground">
                  No files in this dump. Adjust the mode/path filter and try
                  again.
                </CardContent>
              </Card>
            ) : mode === "summary" || isFilesArray ? (
              <Card className="py-4">
                <CardHeader className="px-4 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Project Summary ({fileCount} files)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <div className="divide-y text-xs font-mono">
                    {filesArray.map(([path, sha]) => (
                      <div
                        key={path}
                        className="py-2 flex items-center justify-between gap-3"
                      >
                        <span className="truncate">{path}</span>
                        <div className="flex items-center gap-4 text-muted-foreground shrink-0 tabular-nums">
                          {sha && (
                            <span className="text-[10px] hidden sm:inline text-muted-foreground/70">
                              {sha.slice(0, 12)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filesArray.map(([path, content], index) => (
                  <FileSection
                    key={path}
                    path={path}
                    content={content}
                    isDark={isDark}
                    delay={Math.min(index * 0.01, 0.2)}
                    forceCollapsed={allCollapsed}
                  />
                ))}
              </div>
            )
          ) : (
            /* JSON View Format */
            <Card className="py-4">
              <CardHeader className="px-4 pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  JSON Output Payload
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        JSON.stringify(dump, null, 2)
                      );
                      toast.success("JSON payload copied");
                    } catch {
                      toast.error("Couldn't copy JSON");
                    }
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy JSON
                </Button>
              </CardHeader>
              <CardContent className="px-4">
                <pre className="max-h-[65vh] overflow-auto rounded-md border bg-muted/30 p-3.5 text-xs font-mono whitespace-pre leading-relaxed">
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

export function FileSection({
  path,
  content,
  isDark,
  delay,
  forceCollapsed,
}: {
  path: string;
  content: string;
  isDark: boolean;
  delay: number;
  forceCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [fileCopied, setFileCopied] = React.useState(false);

  React.useEffect(() => {
    if (typeof forceCollapsed === "boolean") {
      setCollapsed(forceCollapsed);
    }
  }, [forceCollapsed]);

  const lang = detectLanguage(path);
  const deferredContent = React.useDeferredValue(content);
  const lineCount = deferredContent ? deferredContent.split("\n").length : 0;
  const byteSize = content ? new Blob([content]).size : 0;

  const handleCopyFile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setFileCopied(true);
      toast.success(`Copied ${fileBaseName(path)}`);
      setTimeout(() => setFileCopied(false), 1200);
    } catch {
      toast.error("Failed to copy file");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay }}
      className="bg-card border rounded-lg overflow-hidden shadow-xs"
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
    >
      <div
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between gap-2 border-b px-3.5 py-2 bg-muted/30 hover:bg-muted/60 cursor-pointer select-none transition-colors"
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
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {fileBaseName(path).split(".").pop()?.toUpperCase()} ·{" "}
            {formatBytes(byteSize)} · {lineCount} lines
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 text-muted-foreground hover:text-foreground"
            title="Copy file content"
            onClick={handleCopyFile}
          >
            {fileCopied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>
      </div>

      {!collapsed && (
        lineCount > 350 ? (
          <pre className="p-3.5 text-[12.5px] font-mono overflow-x-auto whitespace-pre bg-transparent border-none text-foreground/90 leading-relaxed">
            {content || ""}
          </pre>
        ) : (
          <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Loading code preview...</div>}>
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
                opacity: 0.5,
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
          </Suspense>
        )
      )}
    </motion.div>
  );
}

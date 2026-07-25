"use client";

import * as React from "react";
import {
  Search as SearchIcon,
  Regex,
  Loader2,
  FileCode2,
  AlertTriangle,
  ExternalLink,
  Globe,
  FolderGit2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useTinyHubStore } from "../store";
import { ApiError, searchProject, searchGlobal } from "../api";
import { fileBaseName, highlightSnippet } from "../utils";
import type { GlobalSearchResponse, SearchResponse } from "../types";

export function Search() {
  const project = useTinyHubStore((s) => s.currentProject);
  const openFile = useTinyHubStore((s) => s.openFile);
  const setView = useTinyHubStore((s) => s.setView);

  const [query, setQuery] = React.useState("");
  const [regex, setRegex] = React.useState(false);
  const [pathFilter, setPathFilter] = React.useState("");
  const [maxResults, setMaxResults] = React.useState("50");
  const [globalMode, setGlobalMode] = React.useState(false);

  const [result, setResult] = React.useState<SearchResponse | null>(null);
  const [globalResult, setGlobalResult] =
    React.useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  const run = React.useCallback(async () => {
    if (!query.trim()) return;
    if (!globalMode && !project) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setGlobalResult(null);
    setHasSearched(true);
    try {
      if (globalMode) {
        const r = await searchGlobal({
          q: query.trim(),
          regex,
          max: maxResults ? Number(maxResults) : undefined,
        });
        setGlobalResult(r);
      } else {
        const r = await searchProject(project!, {
          q: query.trim(),
          regex,
          path: pathFilter || undefined,
          max: maxResults ? Number(maxResults) : undefined,
        });
        setResult(r);
      }
    } catch (e) {
      const msg =
        e instanceof ApiError || e instanceof Error
          ? e.message
          : "Search failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [project, query, regex, pathFilter, maxResults, globalMode]);

  if (!project && !globalMode) {
    return (
      <div className="bg-card border rounded-lg p-10 grid place-items-center text-center">
        <div className="space-y-3 max-w-sm">
          <div className="mx-auto grid place-items-center size-12 rounded-full bg-muted">
            <SearchIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="font-medium">No project selected</div>
          <Button onClick={() => setView("dashboard")}>Go to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tinyhub-view-enter space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          Search
          <Button
            variant={globalMode ? "default" : "outline"}
            size="sm"
            className="h-6 text-[11px] gap-1.5"
            onClick={() => {
              setGlobalMode((v) => !v);
              setResult(null);
              setGlobalResult(null);
              setHasSearched(false);
            }}
            aria-pressed={globalMode}
            title="Toggle global (all-projects) search"
          >
            <Globe className="size-3" />
            {globalMode ? "Global" : "This project"}
          </Button>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {globalMode ? (
            <>
              Full-text search across <strong>all projects</strong>. Toggle
              regex for power queries.
            </>
          ) : (
            <>
              Full-text search across all files in{" "}
              <code className="font-mono">{project}</code>. Toggle regex for
              power queries.
            </>
          )}
        </p>
      </div>

      {/* Search form */}
      <Card className="py-4">
        <CardContent className="px-4 grid gap-3 sm:grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="space-y-1.5 lg:col-span-1">
            <Label htmlFor="q" className="text-xs">Query</Label>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run();
              }}
            >
              <div className="relative flex-1">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={regex ? "/pattern/gi" : "search term…"}
                  className="pl-8 font-mono h-9"
                  autoFocus
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </div>
              <Button type="submit" disabled={loading || !query.trim()}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SearchIcon className="size-4" />
                )}
                <span className="hidden sm:inline">Search</span>
              </Button>
            </form>
          </div>

          {!globalMode && (
            <div className="space-y-1.5 lg:min-w-[120px]">
              <Label htmlFor="path-filter" className="text-xs">Path filter</Label>
              <Input
                id="path-filter"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                placeholder="src/"
                className="font-mono h-9"
              />
            </div>
          )}

          <div className="space-y-1.5 lg:min-w-[100px]">
            <Label htmlFor="max-res" className="text-xs">Max results</Label>
            <Input
              id="max-res"
              type="number"
              min={1}
              max={500}
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5 flex flex-col">
            <Label htmlFor="regex-toggle" className="text-xs flex items-center gap-1.5">
              <Regex className="size-3" />
              Regex
            </Label>
            <div className="h-9 flex items-center gap-2">
              <Switch
                id="regex-toggle"
                checked={regex}
                onCheckedChange={setRegex}
              />
              <span className="text-xs text-muted-foreground">
                {regex ? "regex" : "literal"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global result meta */}
      {globalResult && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px] h-5">
            {globalResult.count} match{globalResult.count === 1 ? "" : "es"}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5">
            <Globe className="size-3" />
            {globalResult.projects.length} project{globalResult.projects.length === 1 ? "" : "s"}
          </Badge>
          {globalResult.truncated && (
            <Badge variant="outline" className="text-[10px] h-5 tinyhub-chip-mod">
              <AlertTriangle className="size-3" />
              truncated
            </Badge>
          )}
          <span className="ml-auto">for &quot;{globalResult.query}&quot;</span>
        </div>
      )}

      {/* Global truncated warning */}
      {globalResult?.truncated && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Results truncated</AlertTitle>
          <AlertDescription>
            Searched {globalResult.projectsSearched} projects (capped at{" "}
            {globalResult.filesCapPerProject} files/project). Showing the first{" "}
            {globalResult.matches.length} matches. Increase &quot;Max
            results&quot; or narrow your query.
          </AlertDescription>
        </Alert>
      )}

      {/* Global results grouped by project */}
      {globalResult && globalResult.projects.length > 0 && (
        <div className="space-y-4">
          {globalResult.projects.map((pr) => (
            <div key={pr.project} className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <FolderGit2 className="size-3.5 text-amber-500" />
                <code className="font-mono font-medium">{pr.project}</code>
                <Badge variant="outline" className="text-[10px] h-5">
                  {pr.count} match{pr.count === 1 ? "" : "es"}
                </Badge>
              </div>
              <div className="space-y-2 pl-5 border-l">
                {pr.matches.map((m, i) => (
                  <Card
                    key={`${pr.project}-${m.path}-${m.line}-${i}`}
                    className="py-3 hover:border-foreground/30 transition-colors"
                  >
                    <CardContent className="px-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <FileCode2 className="size-3.5 text-muted-foreground shrink-0" />
                        <button
                          type="button"
                          onClick={() => openFile(pr.project, m.path)}
                          className="font-mono truncate text-left hover:underline tinyhub-accent"
                          title={`Open ${m.path} in ${pr.project}`}
                        >
                          {m.path}
                        </button>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                          <ExternalLink className="size-3" />
                          line
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 tabular-nums"
                        >
                          {m.line}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto h-6 text-[11px] px-2"
                          onClick={() => openFile(pr.project, m.path)}
                        >
                          Open
                        </Button>
                      </div>
                      <pre
                        className={cn(
                          "rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono overflow-x-auto tinyhub-scroll whitespace-pre-wrap break-all"
                        )}
                        dangerouslySetInnerHTML={highlightSnippet(
                          m.snippet,
                          query.trim(),
                          regex
                        )}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global no results */}
      {!loading && globalResult && globalResult.matches.length === 0 && (
        <Card className="py-10 border-dashed">
          <CardContent className="px-4 text-center text-sm text-muted-foreground">
            No matches for &quot;{globalResult.query}&quot; across{" "}
            {globalResult.projectsSearched} projects.
          </CardContent>
        </Card>
      )}

      {/* Per-project Result meta */}
      {result && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px] h-5">
            {result.count} match{result.count === 1 ? "" : "es"}
          </Badge>
          {result.truncated && (
            <Badge variant="outline" className="text-[10px] h-5 tinyhub-chip-mod">
              <AlertTriangle className="size-3" />
              truncated
            </Badge>
          )}
          <span className="ml-auto">for &quot;{result.query}&quot;</span>
        </div>
      )}

      {/* Truncated warning */}
      {result?.truncated && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Results truncated</AlertTitle>
          <AlertDescription>
            Showing the first {result.matches.length} matches. Increase the
            &quot;Max results&quot; field or narrow your query / path filter.
          </AlertDescription>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Search error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="py-3">
              <CardContent className="px-4 space-y-2">
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-12 w-full bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty initial state */}
      {!loading && !result && !globalResult && !hasSearched && (
        <Card className="py-10 border-dashed">
          <CardContent className="px-4 text-center space-y-3">
            <div className="mx-auto grid place-items-center size-12 rounded-full bg-muted">
              <SearchIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="font-medium">Search across your code</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Type a query above and hit{" "}
              <kbd className="font-mono border bg-muted px-1 rounded">Enter</kbd>
              . Results will appear here with line numbers and highlighted
              matches.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No results */}
      {!loading && result && result.matches.length === 0 && (
        <Card className="py-10 border-dashed">
          <CardContent className="px-4 text-center text-sm text-muted-foreground">
            No matches for &quot;{result.query}&quot;
            {pathFilter ? ` under "${pathFilter}"` : ""}.
          </CardContent>
        </Card>
      )}

      {/* Results list */}
      {result && result.matches.length > 0 && (
        <div className="space-y-2">
          {result.matches.map((m, i) => (
            <motion.div
              key={`${m.path}-${m.line}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(i * 0.01, 0.3) }}
            >
              <Card className="py-3 hover:border-foreground/30 transition-colors">
                <CardContent className="px-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <FileCode2 className="size-3.5 text-muted-foreground shrink-0" />
                    <button
                      type="button"
                      onClick={() => openFile(project!, m.path)}
                      className="font-mono truncate text-left hover:underline tinyhub-accent"
                      title={`Open ${m.path}`}
                    >
                      {m.path}
                    </button>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <ExternalLink className="size-3" />
                      line
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 tabular-nums"
                    >
                      {m.line}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 text-[11px] px-2"
                      onClick={() => openFile(project!, m.path)}
                    >
                      Open
                    </Button>
                  </div>
                  <pre
                    className={cn(
                      "rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono overflow-x-auto tinyhub-scroll whitespace-pre-wrap break-all"
                    )}
                    dangerouslySetInnerHTML={highlightSnippet(
                      m.snippet,
                      query.trim(),
                      regex
                    )}
                  />
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {fileBaseName(m.path)}:{m.line}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

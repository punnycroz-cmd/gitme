"use client";

import * as React from "react";
import {
  PanelLeft,
  FolderTree,
  FileQuestion,
  RefreshCw,
  CornerDownRight,
  Download,
  Copy,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { FileTree } from "../file-tree";
import { FileViewer } from "../file-viewer";
import { CommitSidebar } from "../commit-sidebar";
import { RenameDialog } from "../rename-dialog";
import { CopyDialog } from "../copy-dialog";
import { useTinyHubStore } from "../store";
import { getTree, getTip, exportProject, ApiError } from "../api";
import { downloadBlob } from "../utils";
import type { TreeNode, TipResponse } from "../types";

export function Browser() {
  const project = useTinyHubStore((s) => s.currentProject);
  const path = useTinyHubStore((s) => s.currentPath);
  const setPath = useTinyHubStore((s) => s.setPath);
  const setView = useTinyHubStore((s) => s.setView);

  const [tree, setTree] = React.useState<TreeNode[] | null>(null);
  const [tip, setTip] = React.useState<TipResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [mobileTreeOpen, setMobileTreeOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    if (!project || exporting) return;
    setExporting(true);
    try {
      const blob = await exportProject(project);
      downloadBlob(blob, `${project}.zip`);
      toast.success(`Exported "${project}" as .zip`, {
        description: `${(blob.size / 1024).toFixed(1)} KB`,
      });
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.status === 413
            ? "Project too large to export (100 MB cap)."
            : e.status === 404
              ? "Project has no files to export."
              : e.message
          : e instanceof Error
            ? e.message
            : `Failed to export "${project}"`;
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  React.useEffect(() => {
    if (!project) {
      setTree(null);
      setTip(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [tr, tp] = await Promise.all([
          getTree(project, { meta: true, pageSize: 5000 }),
          getTip(project).catch(() => null),
        ]);
        if (cancelled) return;
        setTree(tr.tree || []);
        if (tp) setTip(tp);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load tree");
          toast.error("Failed to load file tree");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, refreshKey]);

  // Auto-select first file if nothing selected.
  React.useEffect(() => {
    if (!tree || tree.length === 0) return;
    if (!path) {
      const firstFile = tree.find((n) => n.type === "blob");
      if (firstFile) setPath(firstFile.path);
    } else {
      // Drop selection if it no longer exists in tree.
      const exists = tree.some((n) => n.type === "blob" && n.path === path);
      if (!exists) {
        const firstFile = tree.find((n) => n.type === "blob");
        setPath(firstFile ? firstFile.path : null);
      }
    }
  }, [tree, path, setPath]);

  if (!project) {
    return <NoProject onGoDashboard={() => setView("dashboard")} />;
  }

  const treePane = (
    <TreePane
      tree={tree}
      loading={loading}
      error={error}
      selectedPath={path}
      onSelect={(p) => {
        setPath(p);
        setMobileTreeOpen(false);
      }}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    />
  );

  return (
    <div className="tinyhub-view-enter space-y-3">
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile tree trigger */}
          <Sheet open={mobileTreeOpen} onOpenChange={setMobileTreeOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden h-9"
                aria-label="Open file tree"
              >
                <PanelLeft className="size-4" />
                Files
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:max-w-sm p-3">
              <SheetHeader className="px-1">
                <SheetTitle className="flex items-center gap-2 text-sm">
                  <FolderTree className="size-4 tinyhub-accent" />
                  Files
                  <span className="ml-auto text-xs text-muted-foreground font-normal">
                    {project}
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 min-h-0 overflow-y-auto tinyhub-scroll mt-2">
                {treePane}
              </div>
            </SheetContent>
          </Sheet>

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setView("dashboard")}
                >
                  projects
                </button>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span className="font-mono">{project}</span>
              </BreadcrumbItem>
              {path && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-mono text-sm">
                      {path}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    tip?.commit ? "bg-emerald-500" : "bg-muted-foreground"
                  )}
                />
                <code className="font-mono">
                  {tip?.commit?.slice(0, 8) || "no tip"}
                </code>
              </span>
            </TooltipTrigger>
            <TooltipContent>Current tip of the project</TooltipContent>
          </Tooltip>
          {path && (
            <RenameDialog
              project={project}
              path={path}
              onRenamed={(newPath) => {
                setPath(newPath);
                setRefreshKey((k) => k + 1);
              }}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  aria-label={`Rename ${path}`}
                >
                  <CornerDownRight className="size-3.5" />
                  <span className="hidden sm:inline">Rename</span>
                </Button>
              }
            />
          )}
          {path && (
            <CopyDialog
              project={project}
              path={path}
              onCopied={(newPath) => {
                setPath(newPath);
                setRefreshKey((k) => k + 1);
              }}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  aria-label={`Copy ${path}`}
                >
                  <Copy className="size-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </Button>
              }
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleExport}
                disabled={exporting || !tree || tree.length === 0}
                aria-label={`Download ${project} as .zip`}
              >
                {exporting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {exporting ? "Zipping…" : "Download .zip"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Export the current tip as a .zip archive (with manifest.json)
            </TooltipContent>
          </Tooltip>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* 3-column desktop layout */}
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px] xl:grid-cols-[280px_minmax(0,1fr)_320px] lg:h-[calc(100vh-220px)] min-h-[420px]">
        {/* Left: file tree (desktop) */}
        <aside className="hidden lg:block min-h-0">
          <div className="bg-card border rounded-lg h-full flex flex-col min-h-0">
            <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground flex items-center gap-2">
              <FolderTree className="size-3.5 tinyhub-accent" />
              Files
              <span className="ml-auto text-[10px]">
                {tree
                  ? `${tree.filter((n) => n.type === "blob").length} files`
                  : ""}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto tinyhub-scroll p-1.5">
              {treePane}
            </div>
          </div>
        </aside>

        {/* Center: file viewer */}
        <section className="min-h-0 min-w-0">
          {path ? (
            <FileViewer
              path={path}
              project={project}
              onCommitted={() => setRefreshKey((k) => k + 1)}
            />
          ) : (
            <EmptyFile />
          )}
        </section>

        {/* Right: commit sidebar */}
        <aside className="hidden lg:block min-h-0">
          <CommitSidebar project={project} refreshKey={refreshKey} />
        </aside>
      </div>
    </div>
  );
}

function TreePane({
  tree,
  loading,
  error,
  selectedPath,
  onSelect,
  onRefresh,
}: {
  tree: TreeNode[] | null;
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
  onSelect: (p: string) => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-3 text-xs text-destructive space-y-2">
        <div>{error}</div>
        <Button size="sm" variant="ghost" className="h-7" onClick={onRefresh}>
          <RefreshCw className="size-3" />
          Retry
        </Button>
      </div>
    );
  }
  if (!tree || tree.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No files in this project yet.
      </div>
    );
  }
  return (
    <FileTree tree={tree} selectedPath={selectedPath} onSelect={onSelect} />
  );
}

function EmptyFile() {
  return (
    <div className="bg-card border rounded-lg h-full grid place-items-center p-6">
      <div className="text-center space-y-3 max-w-sm">
        <div className="mx-auto grid place-items-center size-12 rounded-full bg-muted">
          <FileQuestion className="size-5 text-muted-foreground" />
        </div>
        <div className="font-medium">No file selected</div>
        <p className="text-sm text-muted-foreground">
          Pick a file from the tree on the left to view it with syntax
          highlighting. Images render inline.
        </p>
      </div>
    </div>
  );
}

function NoProject({ onGoDashboard }: { onGoDashboard: () => void }) {
  return (
    <div className="bg-card border rounded-lg p-10 grid place-items-center text-center">
      <div className="space-y-3 max-w-sm">
        <div className="mx-auto grid place-items-center size-12 rounded-full bg-muted">
          <FolderTree className="size-5 text-muted-foreground" />
        </div>
        <div className="font-medium">No project selected</div>
        <p className="text-sm text-muted-foreground">
          Choose a project from the switcher above, or upload a new one to get
          started.
        </p>
        <Button onClick={onGoDashboard} className="mt-1">
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}

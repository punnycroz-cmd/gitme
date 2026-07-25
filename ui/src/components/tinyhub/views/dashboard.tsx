"use client";

import * as React from "react";
import {
  Boxes,
  FileStack,
  GitCommitHorizontal,
  Database,
  UploadCloud,
  ArrowRight,
  FolderGit2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Download,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { StatCard } from "../stat-card";
import { RelativeTime } from "../relative-time";
import { DiffChips } from "../diff-chips";
import { ActivitySparkline } from "../activity-sparkline";
import { ContributionHeatmap } from "../contribution-heatmap";
import { ReadmePreview } from "../readme-preview";
import { useTinyHubStore } from "../store";
import { OnboardingTour, replayTour } from "../onboarding-tour";
import { formatBytes, formatNumber, shortHash, downloadBlob } from "../utils";
import { resetProject, exportProject, ApiError } from "../api";
import type { ProjectSummary } from "../types";

interface DashboardProps {
  projects: ProjectSummary[];
  loading: boolean;
  onRefresh: () => void;
}

export function Dashboard({ projects, loading, onRefresh }: DashboardProps) {
  const setProject = useTinyHubStore((s) => s.setProject);
  const setView = useTinyHubStore((s) => s.setView);
  const currentProject = useTinyHubStore((s) => s.currentProject);
  const setHistoryDateFilter = useTinyHubStore((s) => s.setHistoryDateFilter);
  const historyDateFilter = useTinyHubStore((s) => s.historyDateFilter);

  const totalFiles = projects.reduce((s, p) => s + p.filesCount, 0);
  const totalCommits = projects.reduce((s, p) => s + p.commitsCount, 0);
  const totalBytes = React.useMemo(
    () => projects.reduce((s, p) => s + (p.totalBytes ?? 0), 0),
    [projects]
  );

  const handleDelete = async (name: string) => {
    try {
      await resetProject(name);
      toast.success(`Project "${name}" deleted`);
      // If the deleted project was selected, reset selection.
      if (currentProject === name) {
        setProject(null);
        setView("dashboard");
      }
      onRefresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : `Failed to delete "${name}"`
      );
    }
  };

  const handleExport = async (name: string) => {
    try {
      const blob = await exportProject(name);
      // Pull filename from Content-Disposition if present (we set it
      // server-side), otherwise synthesize one.
      const filename = `${name}.zip`;
      downloadBlob(blob, filename);
      toast.success(`Exported "${name}" as .zip`, {
        description: `${formatBytes(blob.size)} · ${blob.type || "application/zip"}`,
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
            : `Failed to export "${name}"`;
      toast.error(msg);
    }
  };

  const recent = React.useMemo(
    () =>
      [...projects].sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
      ),
    [projects]
  );

  return (
    <div className="space-y-6 tinyhub-view-enter">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            Dashboard
            <Badge variant="secondary" className="text-[10px] h-5">
              {loading ? "loading" : `${projects.length} projects`}
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse, upload, search and dump your code — a tiny git-like code host.
            <button
              type="button"
              onClick={replayTour}
              className="ml-2 align-baseline text-foreground/80 underline decoration-dotted underline-offset-4 hover:text-foreground transition-colors"
              aria-label="Replay the TinyHub onboarding tour"
            >
              Take the tour
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setView("upload")}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <UploadCloud className="size-3.5" />
            New upload
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Projects"
          icon={Boxes}
          accent="neutral"
          value={loading ? "…" : formatNumber(projects.length)}
          hint={loading ? "loading…" : "across your user"}
        />
        <StatCard
          label="Total files"
          icon={FileStack}
          accent="add"
          value={loading ? "…" : formatNumber(totalFiles)}
          hint={loading ? "…" : "tracked blobs"}
        />
        <StatCard
          label="Total commits"
          icon={GitCommitHorizontal}
          accent="mod"
          value={loading ? "…" : formatNumber(totalCommits)}
          hint={loading ? "…" : "lifecycle commits"}
        />
        <StatCard
          label="Storage"
          icon={Database}
          accent="del"
          value={loading ? "…" : formatBytes(totalBytes)}
          hint={loading ? "…" : "across all blobs"}
        />
      </div>

      {/* Activity sparkline */}
      <ActivitySparkline
        projects={projects}
        selectedDate={historyDateFilter}
        onSelectDate={(date) => {
          // Toggle: clicking the selected day again clears the filter.
          setHistoryDateFilter(historyDateFilter === date ? null : date);
          setView("history");
        }}
      />

      {/* Contribution heatmap (yearly, GitHub-style) */}
      <ContributionHeatmap />

      {/* Recent projects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent projects</h2>
          {projects.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {projects.length} total
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="py-4">
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-full mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyProjects onUpload={() => setView("upload")} />
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((p, i) => (
              <ProjectCard
                key={p.name}
                project={p}
                index={i}
                onOpen={() => {
                  setProject(p.name);
                  setView("browser");
                }}
                onHistory={() => {
                  setProject(p.name);
                  setView("history");
                }}
                onDelete={() => handleDelete(p.name)}
                onExport={() => handleExport(p.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      {!loading && (
        <Card className="py-6 border-dashed bg-muted/30">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center size-10 rounded-md bg-foreground text-background">
                <UploadCloud className="size-5" />
              </div>
              <div>
                <div className="font-medium">Push a new project</div>
                <p className="text-sm text-muted-foreground">
                  Drag &amp; drop a folder, choose push/merge/replace mode, and
                  commit. TinyHub stores your files and tracks each version.
                </p>
              </div>
            </div>
            <Button onClick={() => setView("upload")}>
              Go to Upload
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* First-time-user onboarding tour. Self-mounts via a portal to
          document.body; renders nothing when the tour is inactive. */}
      <OnboardingTour />
    </div>
  );
}

function ProjectCard({
  project,
  index,
  onOpen,
  onHistory,
  onDelete,
  onExport,
}: {
  project: ProjectSummary;
  index: number;
  onOpen: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const [exporting, setExporting] = React.useState(false);

  const handleExportClick = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -3 }}
    >
      <Card className="py-5 gap-3 h-full group relative">
        <CardHeader className="pb-1 px-5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderGit2 className="size-4 text-amber-500" />
              <span className="truncate font-mono">{project.name}</span>
            </CardTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              {shortHash(project.lastCommit) || "no tip"}
            </Badge>
          </div>
          <CardDescription>
            Updated <RelativeTime ms={project.updatedAt} />
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Files" value={formatNumber(project.filesCount)} />
            <Stat label="Commits" value={formatNumber(project.commitsCount)} />
            <Stat
              label="Size"
              value={formatBytes(project.totalBytes ?? 0)}
            />
          </div>
          <ReadmePreview project={project.name} maxLines={2} />
          <div className="flex items-center justify-between gap-2 pt-1 border-t">
            <DiffChips
              stats={{ added: 0, modified: 0, deleted: 0, unchanged: project.filesCount }}
              showUnchanged
              size="sm"
            />
            <div className="flex items-center gap-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title={`Delete project "${project.name}"`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-destructive" />
                      Delete project "{project.name}"?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes <strong>all files</strong>,{" "}
                      <strong>{project.commitsCount} commit(s)</strong>, and the
                      project record. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Trash2 className="size-3.5" />
                      Delete permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleExportClick}
                    disabled={exporting || project.filesCount === 0}
                    aria-label={`Download ${project.name} as .zip`}
                  >
                    {exporting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {exporting ? "Building .zip…" : "Download .zip"}
                </TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onHistory}>
                History
              </Button>
              <Button size="sm" className="h-7" onClick={onOpen}>
                Open
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 py-2">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function EmptyProjects({ onUpload }: { onUpload: () => void }) {
  return (
    <Card className="py-12 border-dashed">
      <CardContent className="flex flex-col items-center text-center gap-3">
        <div className="grid place-items-center size-12 rounded-full bg-muted">
          <FolderGit2 className="size-5 text-muted-foreground" />
        </div>
        <div className="font-medium">No projects yet</div>
        <p className="text-sm text-muted-foreground max-w-sm">
          Push your first project to get started. TinyHub will track every file
          and commit, then you can browse, search, and export snapshots.
        </p>
        <Button onClick={onUpload} className="mt-1">
          <UploadCloud className="size-4" />
          Upload your first project
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
import {
  UploadCloud,
  FolderUp,
  File as FileIcon,
  X,
  RefreshCw,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  GitCommitVertical,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useTinyHubStore } from "../store";
import { ApiError, getTip, uploadProject } from "../api";
import { isBlocked } from "../blocklist";
import {
  fileToUploadPath,
  formatBytes,
  formatNumber,
} from "../utils";
import type { CommitResult, UploadMode, UploadedFilePreview } from "../types";

const MODE_DESCRIPTIONS: Record<UploadMode, string> = {
  push:
    "Push: replace remote-only files with deletions (mirrors a fresh git push). Use this when you want the repo to look exactly like your upload.",
  merge:
    "Merge: add/modify only — never delete files. Existing remote-only files are preserved. Great for incremental updates.",
  replace:
    "Replace: wipe the project, then upload. Equivalent to a forced re-initialisation. Useful when starting over.",
};

export function Upload() {
  const storeProject = useTinyHubStore((s) => s.currentProject);
  const setProject = useTinyHubStore((s) => s.setProject);
  const setView = useTinyHubStore((s) => s.setView);

  const [project, setProjectName] = React.useState(
    storeProject || "my-app"
  );
  const [mode, setMode] = React.useState<UploadMode>("push");
  const [message, setMessage] = React.useState("");
  const [files, setFiles] = React.useState<UploadedFilePreview[]>([]);
  const [tip, setTip] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<CommitResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Sync project name to store when user types something valid.
  React.useEffect(() => {
    if (project && project !== storeProject) {
      setProject(project);
    }
  }, [project, storeProject, setProject]);

  // Fetch tip whenever project name changes.
  React.useEffect(() => {
    let cancelled = false;
    setTip(null);
    if (!project) return;
    (async () => {
      try {
        const t = await getTip(project);
        if (!cancelled) setTip(t.commit || null);
      } catch {
        if (!cancelled) setTip(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  const addFiles = React.useCallback(
    (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      const next: UploadedFilePreview[] = arr.map((f) => {
        const path = fileToUploadPath(f, project);
        const check = isBlocked(path);
        return {
          path,
          size: f.size,
          blocked: check.blocked,
          reason: check.reason,
          file: f,
        };
      });
      setFiles((prev) => {
        // Merge by path, later wins.
        const map = new Map<string, UploadedFilePreview>();
        for (const p of prev) map.set(p.path, p);
        for (const p of next) map.set(p.path, p);
        return Array.from(map.values()).sort((a, b) =>
          a.path.localeCompare(b.path)
        );
      });
      setResult(null);
      setError(null);
    },
    [project]
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const onFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (path: string) =>
    setFiles((prev) => prev.filter((f) => f.path !== path));

  const clearAll = () => setFiles([]);

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const blockedCount = files.filter((f) => f.blocked).length;
  const uploadable = files.filter((f) => !f.blocked && f.file);

  const handleSubmit = async () => {
    if (!project.trim()) {
      toast.error("Project name is required");
      return;
    }
    if (uploadable.length === 0) {
      toast.error("No uploadable files — drop some files first");
      return;
    }
    setSubmitting(true);
    setProgress(0);
    setError(null);
    setResult(null);
    try {
      const res = await uploadProject({
        proj: project.trim(),
        files: uploadable.map((f) => f.file!),
        mode,
        message: message.trim() || `Upload ${uploadable.length} file(s)`,
        baseTip: tip,
        incremental: mode !== "push", // merge/replace never auto-delete remote-only
        onProgress: (sent, total) =>
          setProgress(total > 0 ? (sent / total) * 100 : 0),
      });
      setResult(res);
      if (res.empty) {
        toast.info("Nothing to commit — everything was already up-to-date");
      } else {
        toast.success(
          `Committed ${res.commit.hash.slice(0, 8)} · +${res.stats.added} ~${res.stats.modified} -${res.stats.deleted}`
        );
      }
      setProject(project.trim());
      setView("browser");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = (e.body as { message?: string; remoteTip?: string }) || {};
        setError(
          `Conflict: remote has newer commits (tip: ${body.remoteTip || "?"}). Refresh the project and try again.`
        );
        toast.error("Conflict — refresh and retry");
      } else {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tinyhub-view-enter space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            Upload
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Push files to a project. Drag &amp; drop or pick a folder. Blocked
            files (secrets, <code>.git</code>, <code>node_modules</code>…) are
            filtered client-side and again on the server.
          </p>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <GitCommitVertical className="size-3.5" />
          base tip:{" "}
          <code className="font-mono">{tip ? tip.slice(0, 8) : "none"}</code>
        </div>
      </div>

      {/* Configuration card */}
      <Card className="py-5">
        <CardHeader className="pb-2 px-5">
          <CardTitle className="text-base">Configuration</CardTitle>
          <CardDescription>
            Choose a project name, push mode and an optional commit message.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="proj">Project name</Label>
            <Input
              id="proj"
              value={project}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-app"
              className="font-mono"
              spellCheck={false}
              autoCapitalize="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Letters, numbers, <code>._-</code> only — max 64 chars.
            </p>
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="mode">Push mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as UploadMode)}
            >
              <SelectTrigger id="mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="push">push</SelectItem>
                <SelectItem value="merge">merge</SelectItem>
                <SelectItem value="replace">replace</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {MODE_DESCRIPTIONS[mode]}
            </p>
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <Label htmlFor="msg">Commit message</Label>
            <Textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Upload ${files.length || "?"} file(s)`}
              className="min-h-[42px] resize-y"
              rows={2}
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground">
              {message.length}/500 — leave blank for an auto-generated message.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-6 sm:p-10 transition-colors tinyhub-dropzone",
          dragOver
            ? "border-foreground/60 bg-accent/40"
            : "border-border hover:border-foreground/40 bg-card/50"
        )}
      >
        <input
          type="file"
          multiple
          className="hidden"
          id="tinyhub-file-input"
          onChange={onFileInput}
        />
        <input
          type="file"
          className="hidden"
          // @ts-expect-error - webkitdirectory is non-standard but supported
          webkitdirectory=""
          directory=""
          multiple
          id="tinyhub-folder-input"
          onChange={onFolderInput}
        />
        <div className="flex flex-col items-center text-center gap-3">
          <motion.div
            initial={false}
            animate={{ scale: dragOver ? 1.08 : 1 }}
            className="grid place-items-center size-14 rounded-full bg-foreground text-background"
          >
            <UploadCloud className="size-7" />
          </motion.div>
          <div className="space-y-1">
            <div className="font-medium">Drag &amp; drop files here</div>
            <p className="text-sm text-muted-foreground">
              or pick individual files / a whole folder
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <Button asChild variant="default">
              <label htmlFor="tinyhub-file-input" className="cursor-pointer">
                <FileIcon className="size-4" />
                Choose files
              </label>
            </Button>
            <Button asChild variant="outline">
              <label htmlFor="tinyhub-folder-input" className="cursor-pointer">
                <FolderUp className="size-4" />
                Choose folder
              </label>
            </Button>
          </div>
        </div>
      </div>

      {/* Files preview */}
      {files.length > 0 && (
        <Card className="py-5">
          <CardHeader className="pb-2 px-5 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Files
                <Badge variant="secondary" className="text-[10px] h-5">
                  {files.length}
                </Badge>
                {blockedCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 tinyhub-chip-del"
                  >
                    {blockedCount} blocked
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {formatNumber(uploadable.length)} uploadable ·{" "}
                {formatBytes(totalSize)} total
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={submitting}
            >
              <X className="size-3.5" />
              Clear all
            </Button>
          </CardHeader>
          <CardContent className="px-3">
            <ul className="max-h-96 overflow-y-auto tinyhub-scroll divide-y">
              {files.map((f, i) => (
                <motion.li
                  key={f.path}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.3) }}
                  className="flex items-center gap-3 px-2 py-2"
                >
                  <FileIcon
                    className={cn(
                      "size-4 shrink-0",
                      f.blocked ? "text-rose-500" : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm truncate" title={f.path}>
                      {f.path}
                    </div>
                    {f.blocked && (
                      <div className="text-[11px] text-rose-500 flex items-center gap-1">
                        <ShieldAlert className="size-3" />
                        {f.reason || "blocked"}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatBytes(f.size)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => removeFile(f.path)}
                    disabled={submitting}
                    aria-label={`Remove ${f.path}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Submit row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={submitting || uploadable.length === 0}
          className="h-10 px-6"
          size="lg"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          {submitting
            ? "Uploading…"
            : `Push ${uploadable.length} file${uploadable.length === 1 ? "" : "s"}`}
        </Button>
        {submitting && (
          <div className="flex-1 flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Upload error</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const t = await getTip(project);
                  setTip(t.commit || null);
                  toast.success("Refreshed base tip — try again");
                } catch {
                  toast.error("Could not refresh tip");
                }
              }}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Result */}
      {result && (
        <Card className="py-5 border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="px-5 flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-500 mt-0.5" />
            <div className="space-y-1 text-sm">
              <div className="font-medium">
                Commit{" "}
                <code className="font-mono">{result.commit.hash}</code> by{" "}
                {result.commit.author}
              </div>
              <div className="text-muted-foreground">{result.commit.message}</div>
              <div className="flex items-center gap-3 pt-1 text-xs">
                <span className="tinyhub-chip-add rounded px-1.5 py-0.5">
                  +{result.stats.added}
                </span>
                <span className="tinyhub-chip-mod rounded px-1.5 py-0.5">
                  ~{result.stats.modified}
                </span>
                <span className="tinyhub-chip-del rounded px-1.5 py-0.5">
                  -{result.stats.deleted}
                </span>
                <span className="text-muted-foreground">
                  · {result.stats.unchanged} unchanged
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

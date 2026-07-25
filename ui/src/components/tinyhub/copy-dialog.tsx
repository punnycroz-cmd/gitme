"use client";

// TinyHub — file copy / duplicate dialog.
// Reads the source file's content via getFileText, then commits it as a new
// file via the /api/projects/[proj]/commit endpoint (add only, no delete).
// On success, calls onCopied(newPath) so the parent view can navigate + refresh.

import * as React from "react";
import { Copy as CopyIcon, Loader2, ArrowRight, Files } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { commitProject, getFileText, ApiError } from "./api";
import { isBlocked } from "./blocklist";
import { fileBaseName } from "./utils";

interface CopyDialogProps {
  project: string;
  path: string;
  onCopied: (newPath: string) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ValidationError {
  ok: false;
  reason: string;
}

function validatePath(p: string): { ok: true } | ValidationError {
  const trimmed = p.trim();
  if (!trimmed) return { ok: false, reason: "Path is required" };
  const clean = trimmed.replace(/\\/g, "/");
  if (clean.startsWith("/")) return { ok: false, reason: "Path must be relative (no leading /)" };
  if (clean.split("/").includes("..")) return { ok: false, reason: "Path cannot contain '..'" };
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return { ok: false, reason: "Path is required" };
  for (const s of parts) {
    if (/[\x00-\x1f]/.test(s)) return { ok: false, reason: "Path contains control characters" };
  }
  const block = isBlocked(clean);
  if (block.blocked) return { ok: false, reason: block.reason || "Path is blocked" };
  return { ok: true };
}

/// Suggest a copy name: "file.js" → "file copy.js", "file copy.js" → "file copy 2.js"
function suggestCopyName(path: string): string {
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const copyMatch = base.match(/^(.*) copy(?: (\d+))?$/);
  if (copyMatch) {
    const n = copyMatch[2] ? parseInt(copyMatch[2], 10) + 1 : 2;
    return `${dir}${copyMatch[1]} copy ${n}${ext}`;
  }
  return `${dir}${base} copy${ext}`;
}

export function CopyDialog({
  project,
  path,
  onCopied,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnChange,
}: CopyDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnChange ?? setInternalOpen;

  const [newPath, setNewPath] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const newPathInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      const suggested = suggestCopyName(path);
      setNewPath(suggested);
      setMessage(`Copy ${fileBaseName(path)} → ${fileBaseName(suggested)}`);
      setTouched(false);
      setSubmitting(false);
      const t = window.setTimeout(() => {
        const el = newPathInputRef.current;
        if (!el) return;
        el.focus();
        el.select();
      }, 60);
      return () => window.clearTimeout(t);
    }
    return;
  }, [open, path]);

  const validation = validatePath(newPath);
  const samePath =
    newPath.trim().replace(/\\/g, "/") === path.replace(/\\/g, "/");
  const canSubmit = !submitting && validation.ok && !samePath;

  async function handleSubmit() {
    setTouched(true);
    if (!validation.ok || samePath) return;

    setSubmitting(true);
    try {
      // Read the source file content.
      const content = await getFileText(project, path);
      if (content === null) {
        toast.error("Source file not found — it may have been removed.");
        return;
      }
      // Commit as a new file (add only).
      const result = await commitProject({
        proj: project,
        message: message.trim() || `Copy ${path} → ${newPath.trim()}`,
        files: { [newPath.trim()]: content },
      });
      const hash = result.commit?.hash;
      toast.success(`Copied to ${newPath.trim()}`, {
        description: hash ? `commit ${hash}` : undefined,
      });
      onCopied(newPath.trim());
      setOpen(false);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409) {
          const body = e.body as
            | { message?: string; remoteTip?: string; yourTip?: string; error?: string }
            | undefined;
          toast.error(body?.message || "Conflict: remote has newer commits", {
            description: "Refresh the browser and try again.",
          });
          return;
        }
        if (e.status === 400) {
          const body = e.body as { error?: string } | undefined;
          toast.error(body?.error || "Invalid request");
          return;
        }
        toast.error(e.message || "Copy failed");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewPathKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const msg = document.getElementById("tinyhub-copy-message");
      if (msg) (msg as HTMLInputElement).focus();
    }
  }

  function handleMessageKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Files className="size-4 tinyhub-accent" />
            Copy / duplicate file
          </DialogTitle>
          <DialogDescription>
            Create a copy of <code className="font-mono text-xs">{path}</code>{" "}
            at a new path. The source file is preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="tinyhub-copy-path" className="text-xs">
              New path
            </Label>
            <Input
              id="tinyhub-copy-path"
              ref={newPathInputRef}
              value={newPath}
              onChange={(e) => {
                setNewPath(e.target.value);
                setTouched(true);
              }}
              onKeyDown={handleNewPathKeyDown}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className={cn(
                "font-mono text-sm",
                touched && !validation.ok && "border-destructive focus-visible:ring-destructive",
                touched && samePath && "border-amber-500 focus-visible:ring-amber-500"
              )}
              aria-invalid={touched && (!validation.ok || samePath)}
              aria-describedby="tinyhub-copy-path-help"
            />
            <div
              id="tinyhub-copy-path-help"
              className="text-[11px] leading-tight min-h-[14px]"
              aria-live="polite"
            >
              {touched && !validation.ok ? (
                <span className="text-destructive">{validation.reason}</span>
              ) : touched && samePath ? (
                <span className="text-amber-600 dark:text-amber-400">
                  New path is the same as the source path.
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="size-3" />
                  <span>Copy to: {newPath.trim() || "—"}</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tinyhub-copy-message" className="text-xs">
              Commit message
            </Label>
            <Input
              id="tinyhub-copy-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleMessageKeyDown}
              spellCheck={false}
              maxLength={500}
              className="text-sm"
              placeholder={`Copy ${fileBaseName(path)}`}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Copying…
              </>
            ) : (
              <>
                <CopyIcon className="size-3.5" />
                Copy file
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

// TinyHub — file rename / move dialog.
// Uses the dedicated /api/projects/[proj]/rename endpoint so it works for binary
// AND text files (raw bytes on the server side). On success, calls onRenamed(newPath)
// so the parent view can update the store + refresh.

import * as React from "react";
import {
  CornerDownRight,
  PencilLine,
  Loader2,
  ArrowRight,
} from "lucide-react";
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

import { renameFile, ApiError } from "./api";
import { isBlocked } from "./blocklist";
import { fileBaseName } from "./utils";

interface RenameDialogProps {
  project: string;
  path: string;
  onRenamed: (newPath: string) => void;
  trigger?: React.ReactNode;
  /** Optional controlled open state (parent manages). */
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

export function RenameDialog({
  project,
  path,
  onRenamed,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnChange,
}: RenameDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnChange ?? setInternalOpen;

  const [newPath, setNewPath] = React.useState(path);
  const [message, setMessage] = React.useState(`Rename ${fileBaseName(path)} → ${fileBaseName(path)}`);
  const [submitting, setSubmitting] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const newPathInputRef = React.useRef<HTMLInputElement>(null);

  // Reset fields whenever the dialog opens for a (potentially) different path.
  React.useEffect(() => {
    if (open) {
      setNewPath(path);
      setMessage(`Rename ${fileBaseName(path)} → ${fileBaseName(path)}`);
      setTouched(false);
      setSubmitting(false);
      // Focus + select the basename so user can type a new name immediately.
      const t = window.setTimeout(() => {
        const el = newPathInputRef.current;
        if (!el) return;
        el.focus();
        const slash = el.value.lastIndexOf("/");
        if (slash >= 0) el.setSelectionRange(slash + 1, el.value.length);
        else el.select();
      }, 60);
      return () => window.clearTimeout(t);
    }
    return;
  }, [open, path]);

  const validation = validatePath(newPath);
  const samePath = newPath.trim().replace(/\\/g, "/") === path.replace(/\\/g, "/");
  const canSubmit =
    !submitting && validation.ok && !samePath;

  async function handleSubmit() {
    setTouched(true);
    if (!validation.ok || samePath) return;

    setSubmitting(true);
    try {
      const result = await renameFile({
        proj: project,
        from: path,
        to: newPath.trim(),
        message: message.trim() || `Rename ${path} → ${newPath.trim()}`,
      });
      const hash = result.commit?.hash;
      toast.success(`Renamed to ${newPath.trim()}`, {
        description: hash ? `commit ${hash}` : undefined,
      });
      onRenamed(newPath.trim());
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
        if (e.status === 404) {
          toast.error("File not found — it may have been removed.");
          return;
        }
        if (e.status === 400) {
          const body = e.body as { error?: string } | undefined;
          toast.error(body?.error || "Invalid request");
          return;
        }
        toast.error(e.message || "Rename failed");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewPathKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      // Move focus to the message field.
      const msg = document.getElementById("tinyhub-rename-message");
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
            <CornerDownRight className="size-4 tinyhub-accent" />
            Rename / move file
          </DialogTitle>
          <DialogDescription>
            Move <code className="font-mono text-xs">{path}</code> to a new path.
            Creates a single commit (adds the new path, deletes the old one).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="tinyhub-rename-path" className="text-xs">
              New path
            </Label>
            <Input
              id="tinyhub-rename-path"
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
              aria-describedby="tinyhub-rename-path-help"
            />
            <div
              id="tinyhub-rename-path-help"
              className="text-[11px] leading-tight min-h-[14px]"
              aria-live="polite"
            >
              {touched && !validation.ok ? (
                <span className="text-destructive">{validation.reason}</span>
              ) : touched && samePath ? (
                <span className="text-amber-600 dark:text-amber-400">
                  New path is the same as the current path.
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="size-3" />
                  <span>Will be moved to: {newPath.trim() || "—"}</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tinyhub-rename-message" className="text-xs">
              Commit message
            </Label>
            <Input
              id="tinyhub-rename-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleMessageKeyDown}
              spellCheck={false}
              maxLength={500}
              className="text-sm"
              placeholder={`Rename ${fileBaseName(path)}`}
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
                Renaming…
              </>
            ) : (
              <>
                <PencilLine className="size-3.5" />
                Rename
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

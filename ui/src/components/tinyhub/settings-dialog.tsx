"use client";

import * as React from "react";
import { Settings2, User, KeyRound, Sun, Moon, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { getAuthor, setAuthor, getToken, setToken } from "./api";

interface SettingsDialogProps {
  onTokenChange?: () => void;
  children?: React.ReactNode;
}

export function SettingsDialog({ onTokenChange, children }: SettingsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [author, setAuthorState] = React.useState("");
  const [token, setTokenState] = React.useState("");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open) {
      setAuthorState(getAuthor());
      setTokenState(getToken());
    }
  }, [open]);

  const save = () => {
    setAuthor(author);
    setToken(token.trim());
    toast.success("Settings saved", {
      description: `Author: ${author.trim() || "server default"} · Token: ${
        token.trim() ? "set" : "cleared"
      }`,
    });
    setOpen(false);
    onTokenChange?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Settings"
          >
            <Settings2 className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-4" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your commit author, auth token, and theme. Stored locally
            in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Author */}
          <div className="space-y-2">
            <Label htmlFor="settings-author" className="text-xs flex items-center gap-1.5">
              <User className="size-3" />
              Commit author name
            </Label>
            <Input
              id="settings-author"
              value={author}
              onChange={(e) => setAuthorState(e.target.value)}
              placeholder="e.g. Andie (empty = server default)"
              className="h-9"
              maxLength={100}
            />
            <p className="text-[11px] text-muted-foreground">
              Attributed to every commit you create (editor, rename, upload).
              Leave blank to use the server default.
            </p>
          </div>

          <Separator />

          {/* Token */}
          <div className="space-y-2">
            <Label htmlFor="settings-token" className="text-xs flex items-center gap-1.5">
              <KeyRound className="size-3" />
              Bearer token (optional)
            </Label>
            <Input
              id="settings-token"
              type="password"
              value={token}
              onChange={(e) => setTokenState(e.target.value)}
              placeholder="dev mode — leave blank"
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Required for writes when <code>TINYHUB_TOKEN</code> env is set on
              the server. In dev mode, writes work without it.
            </p>
          </div>

          <Separator />

          {/* Theme */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Sun className="size-3" />
              Theme
            </Label>
            <div className="flex gap-2">
              <Button
                variant={mounted && theme === "light" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-9"
                onClick={() => setTheme("light")}
              >
                <Sun className="size-3.5" />
                Light
                {mounted && theme === "light" && <Check className="size-3" />}
              </Button>
              <Button
                variant={mounted && theme === "dark" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-9"
                onClick={() => setTheme("dark")}
              >
                <Moon className="size-3.5" />
                Dark
                {mounted && theme === "dark" && <Check className="size-3" />}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>
            <Check className="size-4" />
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

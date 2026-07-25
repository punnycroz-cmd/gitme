"use client";

import * as React from "react";
import { Keyboard, Search, Command, Pencil, Save, GitGraph } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutCheatsheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Shortcut {
  keys: string[];
  label: string;
  icon: typeof Search;
  category: "Navigation" | "Editor" | "Global";
}

const SHORTCUTS: Shortcut[] = [
  // Global
  {
    keys: ["⌘", "K"],
    label: "Open command palette",
    icon: Command,
    category: "Global",
  },
  {
    keys: ["?"],
    label: "Show this shortcut cheatsheet",
    icon: Keyboard,
    category: "Global",
  },
  {
    keys: ["Esc"],
    label: "Close dialog / exit edit mode",
    icon: Keyboard,
    category: "Global",
  },
  // Navigation (via command palette)
  {
    keys: ["⌘", "K"],
    label: "Then type to search views, projects & files",
    icon: Search,
    category: "Navigation",
  },
  // Editor
  {
    keys: ["⌘", "Enter"],
    label: "Save changes (in edit mode)",
    icon: Save,
    category: "Editor",
  },
  {
    keys: ["Esc"],
    label: "Exit edit mode (confirms if unsaved)",
    icon: Pencil,
    category: "Editor",
  },
];

const CATEGORIES = ["Global", "Navigation", "Editor"] as const;

export function ShortcutCheatsheet({
  open,
  onOpenChange,
}: ShortcutCheatsheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up your workflow with these shortcuts. On Windows/Linux,
            use <kbd className="font-mono border bg-muted px-1 rounded">Ctrl</kbd>{" "}
            instead of{" "}
            <kbd className="font-mono border bg-muted px-1 rounded">⌘</kbd>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto tinyhub-scroll">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cat}
              </h3>
              <div className="space-y-1">
                {SHORTCUTS.filter((s) => s.category === cat).map((s, i) => (
                  <div
                    key={`${cat}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <s.icon className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="font-mono text-[11px] border bg-muted px-1.5 py-0.5 rounded shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-muted-foreground text-center border-t pt-2">
          Tip: press{" "}
          <kbd className="font-mono border bg-muted px-1 rounded">?</kbd> anywhere
          to reopen this dialog.
        </div>
      </DialogContent>
    </Dialog>
  );
}

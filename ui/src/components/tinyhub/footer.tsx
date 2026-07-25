"use client";

import * as React from "react";
import {
  Boxes,
  Database,
  FileStack,
  GitCommitHorizontal,
  Keyboard,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { useTinyHubStore } from "./store";
import { formatBytes, formatNumber } from "./utils";
import type { ProjectSummary } from "./types";

interface FooterProps {
  projects: ProjectSummary[];
  user: string | null;
  onOpenShortcuts?: () => void;
}

export function Footer({ projects, user, onOpenShortcuts }: FooterProps) {
  const currentProject = useTinyHubStore((s) => s.currentProject);
  const setView = useTinyHubStore((s) => s.setView);

  const totalFiles = projects.reduce((s, p) => s + p.filesCount, 0);
  const totalCommits = projects.reduce((s, p) => s + p.commitsCount, 0);
  const totalBytes = projects.reduce((s, p) => s + (p.totalBytes ?? 0), 0);

  return (
    <footer className="mt-auto border-t bg-card/30">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-4 lg:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid place-items-center size-6 rounded bg-foreground text-background">
            <Boxes className="size-3.5" />
          </span>
          <span className="font-medium">
            Tiny<span className="tinyhub-accent">Hub</span>
          </span>
          <span className="text-muted-foreground">
            • git-like code host • rebuilt on Next.js
          </span>
        </div>

        <Separator orientation="vertical" className="hidden sm:block h-6" />

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <FileStack className="size-3.5" />
            {formatNumber(projects.length)} project
            {projects.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GitCommitHorizontal className="size-3.5" />
            {formatNumber(totalCommits)} commits · {formatNumber(totalFiles)} files
          </span>
          {user ? (
            <span className="inline-flex items-center gap-1.5">
              <Database className="size-3.5" />
              {formatBytes(totalBytes)}
            </span>
          ) : null}
        </div>

        <div className="sm:ml-auto flex items-center gap-3 text-xs">
          {currentProject ? (
            <button
              type="button"
              onClick={() => setView("dump")}
              className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
              title={`Dump project '${currentProject}'`}
            >
              Dump current project →
            </button>
          ) : (
            <span className="text-muted-foreground">No project selected</span>
          )}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="size-3.5" />
              <kbd className="font-mono text-[10px] border bg-muted px-1 rounded hidden sm:inline">
                ?
              </kbd>
              <span className="sm:hidden">Shortcuts</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}

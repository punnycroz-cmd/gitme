"use client";

import * as React from "react";

import { useTinyHubStore } from "@/components/tinyhub/store";
import { Header } from "@/components/tinyhub/header";
import { Footer } from "@/components/tinyhub/footer";
import { CommandPalette } from "@/components/tinyhub/command-palette";
import { ShortcutCheatsheet } from "@/components/tinyhub/shortcut-cheatsheet";
import { Dashboard } from "@/components/tinyhub/views/dashboard";
import { Browser } from "@/components/tinyhub/views/browser";
import { Upload } from "@/components/tinyhub/views/upload";
import { History } from "@/components/tinyhub/views/history";
import { Dump } from "@/components/tinyhub/views/dump";
import { Search } from "@/components/tinyhub/views/search";
import { listProjects, getHealth } from "@/components/tinyhub/api";
import type { HealthResponse, ProjectSummary } from "@/components/tinyhub/types";

export default function Home() {
  const view = useTinyHubStore((s) => s.view);

  const [projects, setProjects] = React.useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = React.useState(true);
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = React.useState(false);

  const refreshProjects = React.useCallback(async () => {
    setLoadingProjects(true);
    try {
      const ps = await listProjects();
      setProjects(ps);
    } catch {
      // Backend may not be ready yet — keep empty list, no error toast (it
      // would spam on every load).
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  React.useEffect(() => {
    refreshProjects();
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [refreshProjects]);

  // Global keyboard shortcuts:
  //   Cmd/Ctrl+K → toggle command palette
  //   ?          → toggle shortcut cheatsheet (only when not typing in an input)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Shortcut cheatsheet — "?" key, but ignore when the user is typing in
      // an input/textarea/select or a dialog is already open.
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const isEditable =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          target?.isContentEditable;
        if (!isEditable) {
          e.preventDefault();
          setCheatsheetOpen((v) => !v);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header
        projects={projects}
        loadingProjects={loadingProjects}
        onRefreshProjects={refreshProjects}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <main className="flex-1 mx-auto w-full max-w-[1600px] px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {view === "dashboard" && (
          <Dashboard
            projects={projects}
            loading={loadingProjects}
            onRefresh={refreshProjects}
          />
        )}
        {view === "browser" && <Browser />}
        {view === "upload" && <Upload />}
        {view === "history" && <History />}
        {view === "dump" && <Dump />}
        {view === "search" && <Search />}
      </main>

      <Footer
        projects={projects}
        user={health?.user ?? null}
        onOpenShortcuts={() => setCheatsheetOpen(true)}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        projects={projects}
      />

      <ShortcutCheatsheet
        open={cheatsheetOpen}
        onOpenChange={setCheatsheetOpen}
      />
    </div>
  );
}

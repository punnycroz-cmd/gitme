"use client";

import * as React from "react";
import {
  Boxes,
  Moon,
  Sun,
  FolderGit2,
  LayoutDashboard,
  FolderTree,
  UploadCloud,
  GitCommitVertical,
  Download,
  Search,
  KeyRound,
} from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

import { useTinyHubStore } from "./store";
import { getToken, setToken } from "./api";
import type { ProjectSummary, ViewKey } from "./types";
import { RelativeTime } from "./relative-time";
import { SettingsDialog } from "./settings-dialog";

interface HeaderProps {
  projects: ProjectSummary[];
  loadingProjects: boolean;
  onRefreshProjects: () => void;
  onOpenPalette?: () => void;
}

const NAV: { key: ViewKey; label: string; icon: typeof Boxes }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "browser", label: "Browser", icon: FolderTree },
  { key: "upload", label: "Upload", icon: UploadCloud },
  { key: "history", label: "History", icon: GitCommitVertical },
  { key: "search", label: "Search", icon: Search },
  { key: "dump", label: "Dump", icon: Download },
];

export function Header({
  projects,
  loadingProjects,
  onRefreshProjects,
  onOpenPalette,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const view = useTinyHubStore((s) => s.view);
  const setView = useTinyHubStore((s) => s.setView);
  const currentProject = useTinyHubStore((s) => s.currentProject);
  const setProject = useTinyHubStore((s) => s.setProject);

  const current = projects.find((p) => p.name === currentProject) || null;

  // Auto-select first project on initial load and land on the Browser view
  // (one-time). After this, the user can freely navigate to Dashboard etc.
  React.useEffect(() => {
    if (!currentProject && projects.length > 0) {
      setProject(projects[0].name);
      setView("browser");
    }
  }, [projects, currentProject, setProject, setView]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-4 lg:px-6 py-2.5 flex items-center gap-3">
        {/* Logo */}
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="flex items-center gap-2 shrink-0 group"
          aria-label="TinyHub home"
        >
          <span className="grid place-items-center size-8 rounded-md bg-foreground text-background group-hover:scale-105 transition-transform">
            <Boxes className="size-4.5" />
          </span>
          <span className="hidden sm:inline font-semibold tracking-tight">
            Tiny<span className="tinyhub-accent">Hub</span>
          </span>
        </button>

        {/* Project switcher */}
        <Select
          value={currentProject ?? ""}
          onValueChange={(v) => setProject(v)}
        >
          <SelectTrigger
            className="w-[180px] sm:w-[240px] h-9 gap-2"
            aria-label="Switch project"
          >
            <FolderGit2 className="size-4 text-muted-foreground" />
            <SelectValue
              placeholder={
                loadingProjects ? "Loading…" : "Select a project"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Projects</SelectLabel>
              {projects.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  No projects yet — upload to create one.
                </div>
              ) : (
                projects.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.filesCount}f · {p.commitsCount}c
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectGroup>
            <SelectSeparator />
            <div className="px-2 py-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="w-full h-7 text-xs"
                onClick={() => setView("upload")}
              >
                <UploadCloud className="size-3.5" />
                New upload…
              </Button>
            </div>
          </SelectContent>
        </Select>

        {/* Desktop nav */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-1 ml-1"
        >
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = view === key;
            return (
              <Button
                key={key}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-9 gap-1.5", active && "shadow-sm")}
                onClick={() => setView(key)}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4" />
                {label}
              </Button>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1">
          {current && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  tip{" "}
                  <code className="font-mono">{current.lastCommit || "—"}</code>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-0.5">
                  <div>Project tip: {current.lastCommit || "none"}</div>
                  <div>
                    Updated <RelativeTime ms={current.updatedAt} />
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          <TokenButton onRefreshProjects={onRefreshProjects} />

          <SettingsDialog onTokenChange={onRefreshProjects} />

          {onOpenPalette && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 px-2.5 text-muted-foreground hidden sm:flex"
                  aria-label="Open command palette"
                  onClick={onOpenPalette}
                >
                  <Search className="size-3.5" />
                  <kbd className="font-mono text-[10px] border rounded px-1 py-px bg-muted">
                    ⌘K
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Command palette (⌘K)</TooltipContent>
            </Tooltip>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )
            ) : (
              <Sun className="size-4 opacity-0" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile nav: horizontal scrollable bar */}
      <nav
        aria-label="Primary mobile"
        className="md:hidden border-t bg-background/95 overflow-x-auto tinyhub-scroll"
      >
        <div className="flex items-center gap-1 px-2 py-1.5 min-w-max">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = view === key;
            return (
              <Button
                key={key}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setView(key)}
              >
                <Icon className="size-3.5" />
                <span className="text-xs">{label}</span>
              </Button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function TokenButton({
  onRefreshProjects,
}: {
  onRefreshProjects: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [token, setTokenState] = React.useState("");

  React.useEffect(() => {
    setTokenState(getToken());
  }, [open]);

  const save = () => {
    setToken(token.trim());
    toast.success(token.trim() ? "Token saved" : "Token cleared");
    setOpen(false);
    onRefreshProjects();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Auth token settings"
        >
          <KeyRound className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">
          Bearer token (optional)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 space-y-2">
          <Label htmlFor="tinyhub-token" className="text-xs">
            Stored in localStorage as <code>tinyhub_token</code>
          </Label>
          <Input
            id="tinyhub-token"
            type="password"
            value={token}
            onChange={(e) => setTokenState(e.target.value)}
            placeholder="dev mode — leave blank"
            className="h-8"
          />
          <p className="text-[11px] text-muted-foreground">
            In dev mode (no <code>TINYHUB_TOKEN</code> env), uploads work
            without a token.
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 flex-1" onClick={save}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                setTokenState("");
                setToken("");
                toast.success("Token cleared");
                setOpen(false);
                onRefreshProjects();
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import * as React from "react";
import {
  LayoutDashboard,
  FolderTree,
  UploadCloud,
  GitCommitVertical,
  Search,
  Download,
  FolderGit2,
  File as FileIcon,
  Sun,
  Moon,
  CornerDownLeft,
  Folder,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { useTinyHubStore } from "./store";
import { getTree } from "./api";
import { fileExt, fileBaseName } from "./utils";
import type { ProjectSummary, TreeNode, ViewKey } from "./types";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: ProjectSummary[];
}

const VIEW_ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview & stats" },
  { key: "browser", label: "Browser", icon: FolderTree, hint: "Browse files" },
  { key: "upload", label: "Upload", icon: UploadCloud, hint: "Push a project" },
  { key: "history", label: "History", icon: GitCommitVertical, hint: "Commit timeline" },
  { key: "search", label: "Search", icon: Search, hint: "Full-text search" },
  { key: "dump", label: "Dump", icon: Download, hint: "Export bundle" },
];

export function CommandPalette({
  open,
  onOpenChange,
  projects,
}: CommandPaletteProps) {
  const setView = useTinyHubStore((s) => s.setView);
  const setProject = useTinyHubStore((s) => s.setProject);
  const openFile = useTinyHubStore((s) => s.openFile);
  const currentProject = useTinyHubStore((s) => s.currentProject);
  const { theme, setTheme } = useTheme();

  // Cache file trees per project so repeated opens are instant.
  const [treeCache, setTreeCache] = React.useState<Record<string, TreeNode[]>>(
    {}
  );

  // Load the current project's tree when the palette opens.
  React.useEffect(() => {
    if (!open || !currentProject) return;
    if (treeCache[currentProject]) return;
    let cancelled = false;
    (async () => {
      try {
        const tr = await getTree(currentProject, { meta: true, pageSize: 5000 });
        if (!cancelled) {
          setTreeCache((prev) => ({ ...prev, [currentProject]: tr.tree || [] }));
        }
      } catch {
        /* ignore — file group just won't appear */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentProject, treeCache]);

  const close = () => onOpenChange(false);

  const goView = (v: ViewKey) => {
    setView(v);
    close();
  };
  const goProject = (name: string) => {
    setProject(name);
    setView("browser");
    close();
  };
  const goFile = (path: string) => {
    if (currentProject) openFile(currentProject, path);
    close();
  };

  const files = currentProject ? treeCache[currentProject] || [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg gap-0 max-w-xl">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Quick navigation between views, projects and files.
        </DialogDescription>
        <Command className="rounded-lg" loop>
          <CommandInput placeholder="Type a command or search files…" />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No results found.</CommandEmpty>

            {/* Navigation */}
            <CommandGroup heading="Navigate">
              {VIEW_ITEMS.map((v) => (
                <CommandItem
                  key={v.key}
                  value={`go ${v.label} view`}
                  onSelect={() => goView(v.key)}
                  className="gap-2"
                >
                  <v.icon className="size-4 text-muted-foreground" />
                  <span>{v.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {v.hint}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            {/* Projects */}
            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem
                  key={p.name}
                  value={`project ${p.name}`}
                  onSelect={() => goProject(p.name)}
                  className="gap-2"
                >
                  <FolderGit2 className="size-4 text-amber-500" />
                  <span className="font-mono">{p.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {p.filesCount} files · {p.commitsCount} commits
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Files in current project */}
            {files.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup
                  heading={`Files in ${currentProject}`}
                >
                  {files.slice(0, 80).map((n) => {
                    const isFolder = n.type === "tree";
                    const Icon = isFolder ? Folder : FileIcon;
                    return (
                      <CommandItem
                        key={`${n.type}:${n.path}`}
                        value={n.path}
                        onSelect={() => !isFolder && goFile(n.path)}
                        className="gap-2"
                        disabled={isFolder}
                      >
                        <Icon
                          className={
                            isFolder
                              ? "size-4 text-amber-500"
                              : "size-4 text-muted-foreground"
                          }
                        />
                        <span className="font-mono text-sm truncate">
                          {fileBaseName(n.path)}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[50%]">
                          {n.path}
                        </span>
                      </CommandItem>
                    );
                  })}
                  {files.length > 80 && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground text-center">
                      Showing 80 of {files.length} files — refine your search.
                    </div>
                  )}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />

            {/* Theme */}
            <CommandGroup heading="Theme">
              <CommandItem
                value="toggle theme light dark"
                onSelect={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  close();
                }}
                className="gap-2"
              >
                {theme === "dark" ? (
                  <Sun className="size-4 text-amber-500" />
                ) : (
                  <Moon className="size-4 text-indigo-400" />
                )}
                <span>Toggle theme (to {theme === "dark" ? "light" : "dark"})</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="size-3" />
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono border bg-background px-1 rounded">esc</kbd>
              to close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

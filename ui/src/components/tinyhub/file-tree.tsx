"use client";

import * as React from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  File as FileIcon,
  FileCode2,
  FileText,
  Image as ImageIcon,
  FileJson,
  Braces,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { TreeNode } from "./types";
import { fileExt, fileBaseName } from "./utils";

/** A single folder's children rendered recursively. */
interface FolderNode {
  type: "tree";
  path: string;
  children: TreeNode[];
}

interface FileNode {
  type: "blob";
  path: string;
  size?: number | null;
}

type Item = FolderNode | FileNode;

/** Build a hierarchical tree from a flat list of TreeNode entries. */
function buildHierarchy(flat: TreeNode[]): Item[] {
  const dirs = new Map<string, FolderNode>();
  const filesByDir = new Map<string, FileNode[]>();
  const dirSet = new Set<string>();

  for (const n of flat) {
    if (n.type === "tree") dirSet.add(n.path);
  }

  // Walk all dirs and link parent → child.
  const allDirs = [...dirSet].sort();
  for (const p of allDirs) {
    dirs.set(p, { type: "tree", path: p, children: [] });
  }
  for (const p of allDirs) {
    const idx = p.lastIndexOf("/");
    const parent = idx >= 0 ? p.slice(0, idx) : "";
    if (parent && dirs.has(parent)) {
      dirs.get(parent)!.children.push(dirs.get(p)!);
    }
  }

  // Files into their parent buckets.
  for (const n of flat) {
    if (n.type !== "blob") continue;
    const idx = n.path.lastIndexOf("/");
    const parent = idx >= 0 ? n.path.slice(0, idx) : "";
    const list = filesByDir.get(parent) || [];
    list.push({ type: "blob", path: n.path, size: n.size ?? null });
    filesByDir.set(parent, list);
  }

  // Attach each bucket's files into its folder's children (dirs already there).
  for (const [parent, files] of filesByDir) {
    if (parent === "") continue; // root handled below
    const folder = dirs.get(parent);
    if (folder) folder.children.push(...files);
  }

  // Assemble root: top-level dirs + top-level files.
  const root: Item[] = [];
  for (const p of allDirs) {
    const idx = p.lastIndexOf("/");
    if (idx < 0) root.push(dirs.get(p)!);
  }
  const rootFiles = filesByDir.get("") || [];
  root.push(...rootFiles);
  return root;
}

function FileIconFor({ path }: { path: string }) {
  const ext = fileExt(path);
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"].includes(ext))
    return <ImageIcon className="size-3.5 text-fuchsia-500" />;
  if (ext === "json") return <FileJson className="size-3.5 text-amber-500" />;
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext))
    return <FileCode2 className="size-3.5 text-yellow-500" />;
  if (["py"].includes(ext)) return <Braces className="size-3.5 text-emerald-500" />;
  if (["md", "markdown", "txt", "rules", "log", "csv"].includes(ext))
    return <FileText className="size-3.5 text-sky-500" />;
  return <FileIcon className="size-3.5 text-muted-foreground" />;
}

interface FileTreeProps {
  tree: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  className?: string;
}

export function FileTree({
  tree,
  selectedPath,
  onSelect,
  className,
}: FileTreeProps) {
  const items = React.useMemo(() => buildHierarchy(tree), [tree]);

  // Auto-expand the parent of the selected file.
  const initialOpen = React.useMemo(() => {
    if (!selectedPath) return new Set<string>();
    const segs = selectedPath.split("/");
    const open = new Set<string>();
    let acc = "";
    for (let i = 0; i < segs.length - 1; i++) {
      acc = acc ? `${acc}/${segs[i]}` : segs[i];
      open.add(acc);
    }
    return open;
  }, [selectedPath]);

  const [open, setOpen] = React.useState<Set<string>>(initialOpen);
  React.useEffect(() => {
    setOpen((prev) => {
      const next = new Set(prev);
      for (const p of initialOpen) next.add(p);
      return next;
    });
  }, [initialOpen]);

  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <ul className={cn("text-sm select-none", className)} role="tree">
      {items.map((item) => (
        <TreeItem
          key={`${item.type}:${item.path}`}
          item={item}
          depth={0}
          open={open}
          toggle={toggle}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

interface TreeItemProps {
  item: Item;
  depth: number;
  open: Set<string>;
  toggle: (p: string) => void;
  selectedPath: string | null;
  onSelect: (p: string) => void;
}

function TreeItem({
  item,
  depth,
  open,
  toggle,
  selectedPath,
  onSelect,
}: TreeItemProps) {
  const pad = { paddingLeft: `${depth * 12 + 8}px` };

  if (item.type === "tree") {
    const isOpen = open.has(item.path);
    return (
      <li role="treeitem" aria-expanded={isOpen} aria-selected={false}>
        <button
          type="button"
          onClick={() => toggle(item.path)}
          style={pad}
          className="tinyhub-tree-row w-full flex items-center gap-1 py-1 pr-2 text-left rounded-sm"
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform",
              isOpen && "rotate-90"
            )}
          />
          {isOpen ? (
            <FolderOpen className="size-3.5 text-amber-500" />
          ) : (
            <Folder className="size-3.5 text-amber-500" />
          )}
          <span className="truncate">{fileBaseName(item.path)}</span>
        </button>
        {isOpen ? (
          <ul>
            {item.children.map((child) => (
              <TreeItem
                key={`${child.type}:${child.path}`}
                item={child as Item}
                depth={depth + 1}
                open={open}
                toggle={toggle}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  const selected = selectedPath === item.path;
  return (
    <li role="treeitem" aria-selected={selected}>
      <button
        type="button"
        onClick={() => onSelect(item.path)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onSelect(item.path);
          }
        }}
        style={pad}
        className={cn(
          "tinyhub-tree-row w-full flex items-center gap-1.5 py-1 pr-2 text-left rounded-sm",
          selected && "bg-accent text-accent-foreground font-medium"
        )}
        title={item.path}
      >
        <span className="w-3.5 shrink-0" />
        <FileIconFor path={item.path} />
        <span className="truncate">{fileBaseName(item.path)}</span>
      </button>
    </li>
  );
}

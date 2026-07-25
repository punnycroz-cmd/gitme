"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";

import { getFileText } from "./api";
import { cn } from "@/lib/utils";

interface ReadmePreviewProps {
  project: string;
  className?: string;
  maxLines?: number;
}

/// Fetches the README.md (or readme.md / README.markdown) for a project and
/// renders a plain-text snippet (first few non-empty lines). Lightweight —
/// no markdown rendering here (the Browser view handles full rendering).
/// Fails silently (renders nothing) if no README exists.
export function ReadmePreview({
  project,
  className,
  maxLines = 3,
}: ReadmePreviewProps) {
  const [snippet, setSnippet] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Try common README filenames.
      const candidates = ["README.md", "readme.md", "README.markdown", "README.txt"];
      for (const name of candidates) {
        try {
          const text = await getFileText(project, name);
          if (text) {
            if (cancelled) return;
            // Extract a clean snippet: strip markdown headers/markdown syntax,
            // take the first few non-empty lines.
            const lines = text
              .split("\n")
              .map((l) => l.replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim())
              .filter((l) => l.length > 0 && !l.startsWith("<!--"));
            const snip = lines.slice(0, maxLines).join(" · ");
            setSnippet(snip || null);
            setLoading(false);
            return;
          }
        } catch {
          /* try next candidate */
        }
      }
      if (!cancelled) {
        setSnippet(null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, maxLines]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
        <Loader2 className="size-3 animate-spin" />
        <span>Loading README…</span>
      </div>
    );
  }

  if (!snippet) return null;

  return (
    <div className={cn("flex items-start gap-1.5 text-[11px] text-muted-foreground", className)}>
      <FileText className="size-3 shrink-0 mt-0.5 tinyhub-accent" />
      <span className="line-clamp-2 leading-relaxed">{snippet}</span>
    </div>
  );
}

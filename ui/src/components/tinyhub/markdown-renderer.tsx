"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "next-themes";
import {
  Check,
  Copy,
  FileText,
  Eye,
  Code as CodeIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MarkdownRendererProps {
  content: string;
  path: string;
  className?: string;
}

/// Renders markdown content as styled HTML with GitHub-flavored markdown
/// (tables, strikethrough, task lists, autolinks). Includes a toggle between
/// rendered source and raw markdown.
export function MarkdownRenderer({
  content,
  path,
  className,
}: MarkdownRendererProps) {
  const [view, setView] = React.useState<"rendered" | "raw">("rendered");
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 bg-muted/20">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          <span className="font-mono truncate">{path}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={view === "rendered" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setView("rendered")}
            aria-pressed={view === "rendered"}
          >
            <Eye className="size-3.5" />
            Rendered
          </Button>
          <Button
            variant={view === "raw" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setView("raw")}
            aria-pressed={view === "raw"}
          >
            <CodeIcon className="size-3.5" />
            Raw
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCopy}
            title="Copy markdown"
          >
            {copied ? (
              <Check className="size-3.5 tinyhub-accent" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto tinyhub-scroll">
        {view === "raw" ? (
          <pre className="p-4 text-[13px] font-mono leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </pre>
        ) : (
          <div className="tinyhub-markdown p-4 sm:p-6 max-w-4xl">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Render code blocks with a simple styled <pre> (no syntax
                // highlighting here — the raw view + dedicated file viewer
                // handle that). Keeps the markdown renderer lightweight.
                pre: ({ children }) => (
                  <pre className="tinyhub-md-pre">{children}</pre>
                ),
                code: ({ className: codeClass, children, ...props }) => {
                  // Inline vs block: block code is wrapped in <pre>.
                  const isInline = !codeClass;
                  if (isInline) {
                    return (
                      <code className="tinyhub-md-code-inline" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={codeClass} {...props}>
                      {children}
                    </code>
                  );
                },
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="tinyhub-md-link"
                  >
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="tinyhub-md-table-wrap">
                    <table className="tinyhub-md-table">{children}</table>
                  </div>
                ),
                input: ({ checked, ...props }) =>
                  // Task list checkbox — render read-only.
                  checked !== undefined ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      className="tinyhub-md-checkbox"
                      {...props}
                    />
                  ) : (
                    <input {...props} />
                  ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

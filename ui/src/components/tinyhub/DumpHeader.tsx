import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export interface DumpHeaderProps {
  project: string;
  fastMode: boolean;
  setFastMode: (v: boolean) => void;
  loading: boolean;
  fetchDump: () => void;
}

export const DumpHeader: React.FC<DumpHeaderProps> = ({
  project,
  fastMode,
  setFastMode,
  loading,
  fetchDump,
}) => {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          Dump
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Snapshot of <code className="font-mono">{project}</code> as a single
          text bundle. Perfect for handing off to an LLM or generating a
          code-review pack.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* Fast mode toggle */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setFastMode(!fastMode)}
          disabled={loading}
        >
          {fastMode ? "Fast HTML" : "JSON View"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDump}
          disabled={loading}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
};

export default DumpHeader;

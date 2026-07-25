"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Check, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useTinyHubStore } from "./store";

// ─── Tour configuration ────────────────────────────────────────────────────

const TOUR_DONE_KEY = "tinyhub_tour_done";
const HOLE_PAD = 6; // px of breathing room around the target inside the backdrop hole
const POPOVER_GAP = 12; // px gap between target rect and popover
const POPOVER_MAX_WIDTH = 340; // px
const POPOVER_APPROX_HEIGHT = 180; // px, used for placement heuristics
const VIEWPORT_PAD = 12; // px min distance from viewport edge

type Prefer = "below" | "above" | "center";

interface TourStepDef {
  id: string;
  title: string;
  body: string;
  /** Selector function returning the highlight target, or null if missing. */
  target: (() => HTMLElement | null) | null;
  prefer: Prefer;
}

const STEPS: TourStepDef[] = [
  {
    id: "welcome",
    title: "Welcome to TinyHub",
    body:
      "A tiny git-like code host. Let's take a quick tour of the key features.",
    target: null,
    prefer: "center",
  },
  {
    id: "project-switcher",
    title: "Switch projects",
    body:
      "Use this dropdown to switch between your projects. Each project tracks its own files and commits.",
    target: () =>
      document.querySelector<HTMLElement>('[aria-label="Switch project"]'),
    prefer: "below",
  },
  {
    id: "browser-tab",
    title: "Browse files",
    body:
      "Browse your project's file tree, view any file with syntax highlighting, edit in-browser, or check the blame view.",
    // No stable aria-label on the nav tab buttons — match by visible label
    // across both desktop and mobile nav bars.
    target: () => findNavTab("Browser"),
    prefer: "below",
  },
  {
    id: "command-palette",
    title: "Command palette",
    body:
      "Press ⌘K (or click here) to open the command palette — quick navigation to any view, project, or file.",
    target: () =>
      document.querySelector<HTMLElement>(
        '[aria-label="Open command palette"]'
      ),
    prefer: "below",
  },
  {
    id: "upload-tab",
    title: "Push your first project",
    body:
      "Ready to push? Go to Upload to drag-and-drop a folder and create your first commit.",
    target: () => findNavTab("Upload"),
    prefer: "below",
  },
];

function findNavTab(label: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const navs = document.querySelectorAll<HTMLElement>(
    'nav[aria-label="Primary"], nav[aria-label="Primary mobile"]'
  );
  for (const nav of Array.from(navs)) {
    const buttons = nav.querySelectorAll("button");
    for (const btn of Array.from(buttons)) {
      if ((btn.textContent ?? "").trim() === label) {
        return btn;
      }
    }
  }
  return null;
}

interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function getRect(el: HTMLElement): Rect | null {
  try {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  } catch {
    return null;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function computePopoverPos(
  rect: Rect,
  prefer: Prefer
): { top: number; left: number } {
  if (typeof window === "undefined") return { top: 80, left: 80 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = Math.min(POPOVER_MAX_WIDTH, vw - VIEWPORT_PAD * 2);
  const ph = POPOVER_APPROX_HEIGHT;

  // Try the preferred side first, then fall back to the opposite side, then
  // to a centered placement.
  if (prefer === "below" || prefer === "above") {
    const tryBelow = prefer === "below";
    const primaryTop = tryBelow
      ? rect.bottom + POPOVER_GAP
      : rect.top - POPOVER_GAP - ph;
    if (
      primaryTop >= VIEWPORT_PAD &&
      primaryTop + ph <= vh - VIEWPORT_PAD
    ) {
      return {
        top: primaryTop,
        left: clamp(
          rect.left + rect.width / 2 - pw / 2,
          VIEWPORT_PAD,
          vw - pw - VIEWPORT_PAD
        ),
      };
    }
    // Flip.
    const flippedTop = tryBelow
      ? rect.top - POPOVER_GAP - ph
      : rect.bottom + POPOVER_GAP;
    if (
      flippedTop >= VIEWPORT_PAD &&
      flippedTop + ph <= vh - VIEWPORT_PAD
    ) {
      return {
        top: flippedTop,
        left: clamp(
          rect.left + rect.width / 2 - pw / 2,
          VIEWPORT_PAD,
          vw - pw - VIEWPORT_PAD
        ),
      };
    }
  }

  // Center fallback.
  return {
    top: Math.max(VIEWPORT_PAD, Math.round((vh - ph) / 2)),
    left: Math.max(VIEWPORT_PAD, Math.round((vw - pw) / 2)),
  };
}

function buildClipPath(rect: Rect): string {
  // Build a polygon with a rectangular hole at the target. The outer path
  // goes clockwise, the inner hole counter-clockwise, so the even-odd /
  // non-zero winding rule leaves the hole transparent AND non-interactive
  // (clipped elements don't receive pointer events inside the hole).
  const t = Math.max(0, rect.top - HOLE_PAD);
  const l = Math.max(0, rect.left - HOLE_PAD);
  const r = rect.right + HOLE_PAD;
  const b = rect.bottom + HOLE_PAD;
  return [
    "polygon(",
    "0px 0px, 100% 0px, 100% 100%, 0px 100%, 0px 0px,",
    `${l}px ${t}px,`,
    `${l}px ${b}px,`,
    `${r}px ${b}px,`,
    `${r}px ${t}px,`,
    `${l}px ${t}px`,
    ")",
  ].join(" ");
}

// ─── Top-level component ────────────────────────────────────────────────────

export function OnboardingTour() {
  const tourActive = useTinyHubStore((s) => s.tourActive);
  const tourStep = useTinyHubStore((s) => s.tourStep);
  const setTourActive = useTinyHubStore((s) => s.setTourActive);
  const setTourStep = useTinyHubStore((s) => s.setTourStep);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // First-visit detection: if no `tinyhub_tour_done` flag is set in
  // localStorage, kick off the tour at step 0.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const done = window.localStorage.getItem(TOUR_DONE_KEY);
      if (!done) {
        setTourStep(0);
        setTourActive(true);
      }
    } catch {
      // localStorage may be unavailable (private mode, etc.) — no-op.
    }
  }, [setTourActive, setTourStep]);

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      // ignore
    }
    setTourActive(false);
  }, [setTourActive]);

  const next = React.useCallback(() => {
    if (tourStep >= STEPS.length - 1) {
      dismiss();
    } else {
      setTourStep(tourStep + 1);
    }
  }, [tourStep, setTourStep, dismiss]);

  // Keyboard: Escape = dismiss, Enter = advance (unless focus is on an input
  // or a button inside the tour popover — let that element handle the key).
  React.useEffect(() => {
    if (!tourActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      if (e.key === "Enter") {
        const t = e.target as HTMLElement | null;
        if (!t) return;
        const tag = t.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          t.isContentEditable
        ) {
          return;
        }
        // If focus is on a button inside the tour popover, defer to it.
        if (tag === "BUTTON" && t.closest("[data-tinyhub-tour-popover]")) {
          return;
        }
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tourActive, dismiss, next]);

  if (!mounted || !tourActive) return null;

  return (
    <TourPortal step={tourStep} onDismiss={dismiss} onNext={next} />
  );
}

// ─── Portal wrapper ─────────────────────────────────────────────────────────

function TourPortal({
  step,
  onDismiss,
  onNext,
}: {
  step: number;
  onDismiss: () => void;
  onNext: () => void;
}) {
  const def = STEPS[step] ?? STEPS[0];
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [missing, setMissing] = React.useState(false);

  // Find the target element for this step and track its viewport rect as the
  // user scrolls or resizes. Re-runs whenever the step changes.
  React.useEffect(() => {
    if (!def.target) {
      setRect(null);
      setMissing(false);
      return;
    }
    let cancelled = false;
    const el = def.target();
    if (!el) {
      setRect(null);
      setMissing(true);
      return;
    }
    setMissing(false);
    const update = () => {
      if (cancelled) return;
      const r = getRect(el);
      if (r) setRect(r);
    };
    update();
    // Track layout shifts via scroll (capture = true so nested scroll
    // containers also trigger) and viewport resize.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    // Poll once on the next frame in case fonts/layout settle after mount.
    const raf = window.requestAnimationFrame(update);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [def]);

  // Graceful degradation: if the target element isn't in the DOM (e.g. the
  // Cmd+K button is hidden on small viewports), auto-advance after a short
  // delay so the user isn't stuck on an invisible step.
  React.useEffect(() => {
    if (!missing) return;
    const t = window.setTimeout(() => {
      onNext();
    }, 80);
    return () => window.clearTimeout(t);
  }, [missing, onNext]);

  const isWelcome = def.target === null;
  const showSpotlight = !isWelcome && !missing && rect !== null;

  const popoverPos = React.useMemo<
    { top: number; left: number } | null
  >(() => {
    if (isWelcome || !rect) return null;
    return computePopoverPos(rect, def.prefer);
  }, [rect, def, isWelcome]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop: click anywhere outside the spotlight hole to skip. */}
      <Backdrop rect={showSpotlight ? rect : null} onDismiss={onDismiss} />

      {/* Spotlight ring around the highlighted target. */}
      <AnimatePresence>
        {showSpotlight && rect && (
          <motion.div
            key={`spotlight-${def.id}`}
            aria-hidden
            className={
              "pointer-events-none fixed z-[65] rounded-md " +
              "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
            }
            style={{
              top: rect.top - 2,
              left: rect.left - 2,
              width: rect.width + 4,
              height: rect.height + 4,
            }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Step popover */}
      <AnimatePresence mode="wait">
        {popoverPos && !isWelcome && (
          <Popover
            key={`popover-${def.id}`}
            def={def}
            pos={popoverPos}
            step={step}
            total={STEPS.length}
            onDismiss={onDismiss}
            onNext={onNext}
          />
        )}
      </AnimatePresence>

      {/* Centered welcome modal */}
      <AnimatePresence>
        {isWelcome && (
          <WelcomeModal
            key="welcome"
            def={def}
            step={step}
            total={STEPS.length}
            onDismiss={onDismiss}
            onNext={onNext}
          />
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}

// ─── Backdrop ───────────────────────────────────────────────────────────────

function Backdrop({
  rect,
  onDismiss,
}: {
  rect: Rect | null;
  onDismiss: () => void;
}) {
  const clipPath = React.useMemo(
    () => (rect ? buildClipPath(rect) : undefined),
    [rect]
  );
  return (
    <motion.div
      aria-hidden
      onClick={onDismiss}
      className="fixed inset-0 z-[60] bg-black/55"
      style={{ clipPath }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    />
  );
}

// ─── Popover (steps with a target element) ──────────────────────────────────

function Popover({
  def,
  pos,
  step,
  total,
  onDismiss,
  onNext,
}: {
  def: TourStepDef;
  pos: { top: number; left: number };
  step: number;
  total: number;
  onDismiss: () => void;
  onNext: () => void;
}) {
  const isLast = step >= total - 1;
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Move focus into the popover when it appears so keyboard users can
  // immediately press Enter to advance.
  React.useEffect(() => {
    const btn = containerRef.current?.querySelector<HTMLButtonElement>(
      "[data-tour-primary]"
    );
    btn?.focus();
  }, []);

  return (
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`tour-title-${def.id}`}
      aria-describedby={`tour-body-${def.id}`}
      data-tinyhub-tour-popover
      className="fixed z-[70] w-[88vw] max-w-[340px] rounded-xl border bg-popover text-popover-foreground shadow-2xl"
      style={{ top: pos.top, left: pos.left }}
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid place-items-center size-6 rounded-md bg-foreground text-background shrink-0">
              <Sparkles className="size-3.5" />
            </span>
            <h3
              id={`tour-title-${def.id}`}
              className="text-sm font-semibold leading-tight truncate"
            >
              {def.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={onDismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors -mt-0.5 -mr-0.5 p-1 rounded-md hover:bg-muted"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p
          id={`tour-body-${def.id}`}
          className="text-sm text-muted-foreground leading-relaxed"
        >
          {def.body}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span
            className="text-[11px] font-mono text-muted-foreground tabular-nums"
            aria-label={`Step ${step + 1} of ${total}`}
          >
            {step + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={onDismiss}
            >
              Skip
            </Button>
            {isLast ? (
              <Button
                size="sm"
                className="h-8"
                onClick={onDismiss}
                data-tour-primary
              >
                <Check className="size-3.5" />
                Done
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8"
                onClick={onNext}
                data-tour-primary
              >
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Welcome modal (centered, no target) ────────────────────────────────────

function WelcomeModal({
  def,
  step,
  total,
  onDismiss,
  onNext,
}: {
  def: TourStepDef;
  step: number;
  total: number;
  onDismiss: () => void;
  onNext: () => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const btn = containerRef.current?.querySelector<HTMLButtonElement>(
      "[data-tour-primary]"
    );
    btn?.focus();
  }, []);

  return (
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tour-title-${def.id}`}
      aria-describedby={`tour-body-${def.id}`}
      data-tinyhub-tour-popover
      className="fixed z-[70] left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-popover text-popover-foreground shadow-2xl"
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center size-10 rounded-xl bg-foreground text-background shrink-0">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              TinyHub · Onboarding
            </div>
            <h3
              id={`tour-title-${def.id}`}
              className="text-lg font-semibold leading-tight"
            >
              {def.title}
            </h3>
          </div>
        </div>
        <p
          id={`tour-body-${def.id}`}
          className="text-sm text-muted-foreground leading-relaxed"
        >
          {def.body}
        </p>
        <div className="flex items-center justify-between gap-2 pt-2">
          <span
            className="text-[11px] font-mono text-muted-foreground tabular-nums"
            aria-label={`Step ${step + 1} of ${total}`}
          >
            {step + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Skip tour
            </Button>
            <Button size="sm" onClick={onNext} data-tour-primary>
              Start tour
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Helper for replaying the tour (used by the Dashboard) ──────────────────

/**
 * Resets the `tinyhub_tour_done` localStorage flag and activates the tour
 * at step 0. Safe to call from any client component.
 */
export function replayTour() {
  try {
    window.localStorage.removeItem(TOUR_DONE_KEY);
  } catch {
    // ignore
  }
  useTinyHubStore.getState().setTourStep(0);
  useTinyHubStore.getState().setTourActive(true);
}

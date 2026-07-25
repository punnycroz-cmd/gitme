// TinyHub — global UI state via zustand.

"use client";

import { create } from "zustand";

import type { ViewKey } from "./types";

interface TinyHubState {
  view: ViewKey;
  currentProject: string | null;
  currentPath: string | null;
  searchQueryOpen: boolean;
  /// Date filter for the History view (YYYY-MM-DD or null).
  historyDateFilter: string | null;
  /// Onboarding tour state. The OnboardingTour component sets `tourActive`
  /// to true on first mount when no `tinyhub_tour_done` localStorage flag is
  /// present. `tourStep` is the 0-based index into the tour's step list.
  tourActive: boolean;
  tourStep: number;
  // setters
  setView: (v: ViewKey) => void;
  setProject: (p: string | null) => void;
  setPath: (p: string | null) => void;
  openFile: (project: string, path: string) => void;
  setHistoryDateFilter: (d: string | null) => void;
  setTourActive: (v: boolean) => void;
  setTourStep: (n: number) => void;
  reset: () => void;
}

export const useTinyHubStore = create<TinyHubState>((set) => ({
  view: "dashboard",
  currentProject: null,
  currentPath: null,
  searchQueryOpen: false,
  historyDateFilter: null,
  tourActive: false,
  tourStep: 0,
  setView: (v) => set({ view: v }),
  setProject: (p) =>
    set({ currentProject: p, currentPath: null }),
  setPath: (p) => set({ currentPath: p }),
  openFile: (project, path) =>
    set({ currentProject: project, currentPath: path, view: "browser" }),
  setHistoryDateFilter: (d) => set({ historyDateFilter: d }),
  setTourActive: (v) => set({ tourActive: v }),
  setTourStep: (n) => set({ tourStep: n }),
  reset: () => set({ view: "dashboard", currentProject: null, currentPath: null, historyDateFilter: null }),
}));

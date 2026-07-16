"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface EnvironmentPanelState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const EnvironmentPanelContext = createContext<EnvironmentPanelState | null>(null);
const WIDE_ENVIRONMENT_QUERY = "(min-width: 1760px)";

function subscribeToEnvironmentViewport(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(WIDE_ENVIRONMENT_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isWideEnvironmentViewport(): boolean {
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia(WIDE_ENVIRONMENT_QUERY).matches;
}

export function EnvironmentPanelProvider({ children }: { children: ReactNode }) {
  const isWideViewport = useSyncExternalStore(
    subscribeToEnvironmentViewport,
    isWideEnvironmentViewport,
    () => false
  );
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? isWideViewport;
  const setOpen = useCallback((nextOpen: boolean) => setOpenOverride(nextOpen), []);
  const toggle = useCallback(
    () => setOpenOverride((current) => !(current ?? isWideViewport)),
    [isWideViewport]
  );
  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
    }),
    [open, setOpen, toggle]
  );

  return (
    <EnvironmentPanelContext.Provider value={value}>{children}</EnvironmentPanelContext.Provider>
  );
}

export function useEnvironmentPanel(): EnvironmentPanelState | null {
  return useContext(EnvironmentPanelContext);
}

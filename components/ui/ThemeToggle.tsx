"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHasMounted } from "@/components/ui/use-has-mounted";
import {
  notifyThemeChanged,
  persistThemeChoice,
  readThemeChoice,
  resolveThemeChoice,
  type AppliedTheme,
  type ThemeChoice,
} from "@/lib/theme";

/** SSR-safe snapshot returning 'system' on the server. */
function getServerSnapshot(): ThemeChoice {
  return "system";
}

function subscribeStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Sync across tabs (only fires for *other* tabs)
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export default function ThemeToggle() {
  const hasMounted = useHasMounted();
  // Tracks the persisted choice; uses useSyncExternalStore so the
  // hydrated value reads from localStorage on the client without a
  // setState-in-effect dance. Returns 'system' on the server.
  const choice = useSyncExternalStore(subscribeStorage, readThemeChoice, getServerSnapshot);
  const setChoice = (next: ThemeChoice) => {
    if (typeof window === "undefined") return;
    try {
      persistThemeChoice(next);
      notifyThemeChanged();
    } catch {
      toast.error("Couldn't save the appearance setting");
    }
  };

  // Apply theme whenever the choice changes (incl. system clock).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const applied = resolveThemeChoice(choice);
    document.documentElement.classList.toggle("dark", applied === "dark");
  }, [choice]);

  // Track OS-level color-scheme changes when user is on `system`.
  useEffect(() => {
    if (typeof window === "undefined" || choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [choice]);

  const applied: AppliedTheme = resolveThemeChoice(choice);
  const Icon = applied === "dark" ? Sun : Moon;

  if (!hasMounted) {
    return (
      <Button variant="outline" size="icon" aria-label="Toggle theme" title="Toggle theme" disabled>
        <Moon className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Toggle theme" title="Toggle theme">
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={choice} onValueChange={(v) => setChoice(v as ThemeChoice)}>
          <DropdownMenuRadioItem value="light">
            <Sun className="h-4 w-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="h-4 w-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="h-4 w-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

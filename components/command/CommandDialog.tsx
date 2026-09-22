"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, FileText, Compass, ArrowUpRight } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

import styles from "./CommandDialog.module.css";
import {
  DEFAULT_SHORTCUTS,
  filterCommandItems,
  labsItemToCommandItem,
  type CommandItem,
} from "@/lib/command/filterCommandItems";
import { flattenToList, type LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import { requestAppNavigation } from "@/lib/app-navigation";

interface CommandDialogProps {
  /** Labs tree to flatten for workspace/docs entries */
  tree?: LabsSidebarTree;
  /** Extra shortcut items (defaults to DEFAULT_SHORTCUTS) */
  shortcuts?: CommandItem[];
  /** Recent items for empty query (first N shown); defaults to shortcuts.slice(0,5) + tree head */
  recents?: CommandItem[];
  /** When set, dialog is visibility-gated to this trigger's layout */
  hiddenRoutes?: string[];
}

const HIDDEN_PREFIXES = ["/runtime/local"];

function isHiddenRoute(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[data-editor]") || target.closest("[contenteditable='true']")) return true;
  return false;
}

export default function CommandDialog({
  tree,
  shortcuts = DEFAULT_SHORTCUTS,
  recents,
  hiddenRoutes,
}: CommandDialogProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const hiddenPrefixes = hiddenRoutes ?? HIDDEN_PREFIXES;

  // Build combined list: shortcuts + flattened tree
  const combined = useMemo<CommandItem[]>(() => {
    const fromTree: CommandItem[] = tree ? flattenToList(tree).map(labsItemToCommandItem) : [];
    const base: CommandItem[] = [...shortcuts, ...fromTree];
    // Attach recentRank for empty-query ordering if recents supplied
    if (recents && recents.length > 0) {
      const recentIds = new Set(recents.map((r) => r.id));
      return base.map((item) => {
        const idx = recents.findIndex((r) => r.id === item.id);
        if (idx !== -1) return { ...item, recentRank: idx };
        if (recentIds.has(item.id)) return item;
        return item;
      });
    }
    // Default: first 5 shortcuts are recents
    const defaultRecentIds = new Set(shortcuts.slice(0, 5).map((s) => s.id));
    return base.map((item) =>
      defaultRecentIds.has(item.id)
        ? { ...item, recentRank: shortcuts.findIndex((s) => s.id === item.id) }
        : item
    );
  }, [tree, shortcuts, recents]);

  const filtered = useMemo(() => filterCommandItems(combined, query), [combined, query]);

  // Derive clamped index instead of cascading setState in effect; query change resets via handleQueryChange
  const clampedActiveIndex = activeIndex >= filtered.length ? 0 : activeIndex;

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(0);
  }, []);

  const isHidden = useMemo(() => {
    return hiddenPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }, [pathname, hiddenPrefixes]);

  // Focus restore on close
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        if (isHidden) return;
        // visibility gate: trigger must be layout-visible
        const t = triggerRef.current;
        if (t && t.getClientRects().length === 0) return;
        // Do not steal from editor when it owns CmdK/N
        if (pathname.startsWith("/editor")) return;
        lastTriggerRef.current = (document.activeElement as HTMLElement) ?? t;
        setOpen(true);
        setQuery("");
        setActiveIndex(0);
      } else {
        setOpen(false);
        // Restore focus to trigger after Radix close animation frame
        requestAnimationFrame(() => {
          const toFocus = lastTriggerRef.current ?? triggerRef.current;
          toFocus?.focus();
        });
      }
    },
    [isHidden, pathname]
  );

  const pick = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      // Focus restore before navigation (assertable via document.activeElement === trigger)
      requestAnimationFrame(() => {
        (lastTriggerRef.current ?? triggerRef.current)?.focus();
      });
      if (!requestAppNavigation()) return;
      router.push(item.href);
    },
    [router]
  );

  // Global CmdK/CtrlK
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
      if (!isK) return;

      // If dialog already open, let input handle keys (don't prevent Esc etc twice)
      if (open) {
        // CmdK while open → close
        e.preventDefault();
        handleOpenChange(false);
        return;
      }

      // Hidden route gate
      if (isHiddenRoute(pathname) || isHidden) return;
      // Editor owns CmdK/N when on /editor: do not hijack
      if (pathname.startsWith("/editor")) return;
      // Don't hijack when typing in an input/contenteditable (except our own input is not yet open)
      if (isTypingTarget(e.target)) return;
      // Visibility gate via getClientRects
      const t = triggerRef.current;
      if (t && t.getClientRects().length === 0) return;

      e.preventDefault();
      if (!requestAppNavigation()) return;
      handleOpenChange(true);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pathname, isHidden, handleOpenChange]);

  // Auto-focus input when opening
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Don't render trigger on hidden routes? Keep it but hidden -> getClientRects =0 gates keys
  // Instead we render trigger always but hide visually via CSS when isHidden
  const triggerVisible = !isHidden;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          aria-label="Open command palette (⌘K)"
          data-testid="command-trigger"
          data-command-trigger
          style={triggerVisible ? undefined : { display: "none" }}
        >
          <Search aria-hidden />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} onClick={() => handleOpenChange(false)} />
        <Dialog.Content
          className={styles.content}
          aria-label="Command palette"
          aria-describedby={undefined}
          onEscapeKeyDown={() => handleOpenChange(false)}
          onPointerDownOutside={() => handleOpenChange(false)}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>

          <div className={styles.inputRow}>
            <Search aria-hidden />
            <input
              ref={inputRef}
              className={styles.input}
              placeholder="Search commands, pages, documents…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => {
                    const base = i >= filtered.length ? 0 : i;
                    return Math.min(base + 1, filtered.length - 1);
                  });
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => {
                    const base = i >= filtered.length ? 0 : i;
                    return Math.max(base - 1, 0);
                  });
                } else if (e.key === "Enter") {
                  const cur = filtered[clampedActiveIndex];
                  if (cur) {
                    e.preventDefault();
                    pick(cur);
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleOpenChange(false);
                }
              }}
              aria-label="Search commands"
              autoComplete="off"
              spellCheck={false}
            />
            <span className={styles.kbd} aria-hidden>
              ESC
            </span>
          </div>

          <div className={styles.list} role="listbox" aria-label="Results">
            {filtered.length === 0 ? (
              <div className={styles.empty} role="status">
                No results for “{query}”
              </div>
            ) : (
              <>
                {query.trim().length === 0 ? (
                  <div className={styles.groupLabel}>Recents</div>
                ) : null}
                {filtered.map((item, idx) => {
                  const isActive = idx === clampedActiveIndex;
                  return (
                    <button
                      key={item.id + item.href}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive ? "true" : "false"}
                      className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => pick(item)}
                    >
                      {item.group ? (
                        <Compass className={styles.itemIcon} aria-hidden />
                      ) : item.href.startsWith("/read") ? (
                        <FileText className={styles.itemIcon} aria-hidden />
                      ) : (
                        <Search className={styles.itemIcon} aria-hidden />
                      )}
                      <span className={styles.itemLabel}>{item.label}</span>
                      <span className={styles.itemHint} aria-hidden>
                        <ArrowUpRight style={{ width: 12, height: 12 }} />
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          <div className={styles.footer} aria-hidden>
            <span>
              <kbd>↑</kbd> <kbd>↓</kbd> navigate
            </span>
            <span>
              <kbd>↵</kbd> open
            </span>
            <span>
              <kbd>ESC</kbd> close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

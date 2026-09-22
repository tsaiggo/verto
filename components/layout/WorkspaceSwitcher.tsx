"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./WorkspaceSwitcher.module.css";

/**
 * Workspace switcher menu — ports workspaceMenu (211px, shadow 0 10px 35px)
 * from design-labs workspace WorkspaceSidebar.tsx:400-418 + styles.css:476-484.
 *
 * Cold tokens, radius 10/8, Inter. No decorative gradient beyond allowed 23px
 * mark (here replaced by muted dot for cold palette).
 *
 * Focus: trigger retains focus semantics, Esc closes and restores, click
 * outside closes. Single menu instance; backdrop blur is owned by dialogs,
 * not this menu (menu has no blur — only dialog overlay blurs).
 */
export interface WorkspaceSwitcherProps {
  label?: string;
  onSelectWorkspace?: (id: string) => void;
}

export default function WorkspaceSwitcher({
  label = "Library",
  onSelectWorkspace,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  // Click outside + Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div className={styles.root} data-testid="workspace-switcher-root">
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        data-testid="workspace-switcher-trigger"
      >
        <span className={styles.triggerDot} aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown className={styles.triggerChevron} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          data-testid="workspace-switcher-menu"
        >
          <span className={styles.menuLabel}>Your workspace</span>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => {
              onSelectWorkspace?.("default");
              close();
            }}
            data-testid="workspace-switcher-item"
          >
            <span className={styles.menuDot} aria-hidden="true" />
            <span>{label}</span>
            <span className={styles.currentDot} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

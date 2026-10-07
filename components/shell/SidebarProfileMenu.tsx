"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { CircleHelp, Moon, Plug, Settings2, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import navStyles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import styles from "./WorkspaceShell.module.css";

function toggleTheme(event: Event) {
  event.preventDefault();
  const choice = window.localStorage.getItem("theme");
  const dark =
    choice === "dark" ||
    (choice !== "light" &&
      (document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches));
  const next = dark ? "light" : "dark";
  window.localStorage.setItem("theme", next);
  window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));
  document.documentElement.classList.toggle("dark", next === "dark");
}

export default function SidebarProfileMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(styles.iconButton, styles.profileButton)}
          aria-label="Verto menu"
          title="Verto menu"
          data-testid="sidebar-profile-menu"
        >
          <span className={cn(navStyles.gradientMark, styles.profileAvatar)} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.sidebarProfileMenu}
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          loop
        >
          <DropdownMenu.Item asChild>
            <Link href="/settings">
              <Settings2 aria-hidden="true" />
              <span>Settings</span>
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={toggleTheme}>
            <Moon className={styles.themeLightIcon} aria-hidden="true" />
            <Sun className={styles.themeDarkIcon} aria-hidden="true" />
            <span>Theme</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/help">
              <CircleHelp aria-hidden="true" />
              <span>Help</span>
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className={styles.profileMenuSeparator} />
          <DropdownMenu.Item asChild>
            <Link href="/integrations">
              <Plug aria-hidden="true" />
              <span>Manage sources</span>
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { cn } from "@/lib/utils";
import navStyles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import styles from "./WorkspaceShell.module.css";

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
            <Link href="/integrations">Manage sources</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link href="/settings/general">Preferences</Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

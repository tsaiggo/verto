"use client";

import Link from "next/link";
import { Bell, MoreHorizontal, Search } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Standard right-side action cluster shared by every page header: a Cmd-K
 * search pill, theme toggle, notifications, and an overflow menu.
 */
export default function HeaderActions() {
  return (
    <div className="pgh-actions">
      <Link href="/search" className="pgh-search" title="Search (⌘K)">
        <Search className="pgh-search-icon" aria-hidden />
        <span className="pgh-search-label">Search Verto</span>
        <kbd className="pgh-search-kbd">⌘K</kbd>
      </Link>

      <ThemeToggle />

      <Link href="/inbox" className="pgh-iconbtn" aria-label="Notifications" title="Notifications">
        <Bell className="pgh-iconbtn-icon" aria-hidden />
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="pgh-iconbtn" aria-label="More options">
            <MoreHorizontal className="pgh-iconbtn-icon" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/integrations">Sources &amp; integrations</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/help">Help &amp; docs</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/activity">Activity</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

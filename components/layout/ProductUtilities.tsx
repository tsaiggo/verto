"use client";

import Link from "next/link";
import { BookOpen, FolderInput, MoreVertical, Settings } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Global utilities placed with the page's primary actions on entity surfaces. */
export default function ProductUtilities() {
  return (
    <div className="pgh-utilities">
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="vx-iconbtn" aria-label="Product actions">
            <MoreVertical aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/integrations">
              <FolderInput aria-hidden /> Sources
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings aria-hidden /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/help">
              <BookOpen aria-hidden /> Help
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

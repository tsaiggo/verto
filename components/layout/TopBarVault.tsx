"use client";

// Source ("vault") pill for the top bar's left edge.
//
// Mirrors the workspace prototype's vault switcher silhouette (source glyph +
// name + chevron) but stays honest: content sources are configured through the
// environment, not switched at runtime, so the chevron opens a real menu that
// surfaces the active source's details and links to /integrations. It never
// fakes an in-place source switch.

import Link from "next/link";
import {
  ChevronDown,
  Cloud,
  ExternalLink,
  Github,
  HardDrive,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SourceInfo } from "@/lib/source-info";

const SOURCE_ICON = {
  github: Github,
  onedrive: Cloud,
  local: HardDrive,
} as const;

export default function TopBarVault({ source }: { source: SourceInfo }) {
  const SourceIcon = SOURCE_ICON[source.kind];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="app-topbar-vault" aria-label="Source details">
          <SourceIcon className="app-topbar-vault-icon" aria-hidden />
          <span className="app-topbar-vault-name">{source.name}</span>
          <ChevronDown className="app-topbar-vault-chevron" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          {source.name}
          <span className="block text-xs font-normal text-text-muted">{source.label}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {source.url && (
          <DropdownMenuItem asChild>
            <a href={source.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open source
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/integrations">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Manage sources
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

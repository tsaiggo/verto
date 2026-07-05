"use client";

// Compact account anchor for the top bar's right edge.
//
// On desktop the real account control is <GitHubLogin/> (an avatar when signed
// in, a "Sign in" button otherwise), so this renders nothing there to avoid a
// duplicate. In the web build, where GitHubLogin is inert, this fills the
// top-right corner with a neutral "guest" avatar that opens an honest menu —
// no fake sign-in affordance, just a guest note plus genuinely useful links.

import Link from "next/link";
import { Github, LifeBuoy, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth/AuthProvider";

const REPO_URL = "https://github.com/tsaiggo/verto";

export default function TopBarAccount() {
  const { available } = useAuth();

  // Desktop → GitHubLogin owns this slot; stay out of its way.
  if (available) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="app-topbar-avatar"
          aria-label="Account menu"
          title="Browsing as guest"
        >
          <User className="app-topbar-avatar-icon" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          Browsing as guest
          <span className="block text-xs text-text-muted">Sign in from the desktop app</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/help">
            <LifeBuoy className="h-4 w-4" aria-hidden />
            Help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            <Github className="h-4 w-4" aria-hidden />
            View on GitHub
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

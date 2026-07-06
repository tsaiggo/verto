"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, MoreVertical, Search } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface VxTopBarProps {
  onMenu: () => void;
}

/**
 * Redesign top bar — present on every product surface. A source-prefixed
 * breadcrumb slot on the left (dashboards leave it empty, since the page title
 * lives in the content), and the workspace action cluster on the right: the
 * global Search Verto pill (⌘K), theme toggle, and an overflow control.
 */
export default function VxTopBar({ onMenu }: VxTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (pathname === "/search") return;
        e.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return (
    <header className="vx-topbar">
      <button
        type="button"
        className="vx-topbar-menu"
        aria-label="Open navigation"
        onClick={onMenu}
      >
        <Menu aria-hidden />
      </button>

      <nav aria-label="Breadcrumb" className="vx-crumbs" />

      <div className="vx-topbar-spacer" />

      <Link href="/search" className="vx-search" title="Search (⌘K)">
        <Search className="vx-search-icon" aria-hidden />
        <span className="vx-search-label">Search Verto</span>
        <kbd className="vx-kbd">⌘ K</kbd>
      </Link>

      <ThemeToggle />

      <button type="button" className="vx-iconbtn" aria-label="More">
        <MoreVertical aria-hidden />
      </button>
    </header>
  );
}

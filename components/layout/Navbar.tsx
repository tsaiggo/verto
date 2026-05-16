'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function Navbar() {
  return (
    <nav
      className="fixed top-0 right-0 left-0 flex items-center border-b border-border bg-background px-5 transition-[background-color,border-color] duration-150 ease-in-out"
      style={{ height: 'var(--navbar-h)', zIndex: 200 }}
      aria-label="Top navigation"
    >
      <div className="flex w-full items-center gap-3">
        {/* Hamburger — mobile only */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Open menu"
              className="md:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0">
            <SheetTitle className="sr-only">Site navigation</SheetTitle>
            <div
              className="flex shrink-0 items-center border-b border-border px-5"
              style={{ height: 'var(--navbar-h)' }}
            />
            <nav className="flex flex-1 flex-col items-center justify-center gap-8">
              <Link
                href="/read"
                className="text-2xl font-medium text-text-muted no-underline transition-colors duration-150 ease-in-out hover:text-foreground"
              >
                Library
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-foreground no-underline"
          style={{ letterSpacing: '-0.4px' }}
        >
          <div
            className="grid shrink-0 place-items-center"
            style={{
              width: 26,
              height: 26,
              background: 'var(--text)',
              borderRadius: 6,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              xmlns="http://www.w3.org/2000/svg"
              style={{ fill: 'var(--bg)' }}
            >
              <path d="M4 4l8 16 8-16H4z" />
            </svg>
          </div>
          <span>Verto</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Nav links — desktop only */}
        <Link
          href="/read"
          className="hidden text-sm font-medium text-text-muted no-underline transition-colors duration-150 ease-in-out hover:text-foreground md:inline"
        >
          Library
        </Link>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </nav>
  );
}

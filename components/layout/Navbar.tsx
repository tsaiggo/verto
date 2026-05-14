'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';
import MobileMenu from '@/components/ui/MobileMenu';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed top-0 right-0 left-0 flex items-center border-b border-border px-5 transition-[background-color,border-color] duration-[150ms] ease-in-out"
        style={{
          height: 'var(--navbar-h)',
          background: 'var(--bg)',
          zIndex: 200,
        }}
        aria-label="Top navigation"
      >
        <div className="flex w-full items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Toggle sidebar"
            className="grid cursor-pointer place-items-center rounded-[7px] border border-border bg-transparent text-text-muted transition-[background-color,color,border-color] duration-[150ms] ease-in-out hover:bg-bg-muted hover:text-text md:hidden"
            style={{ width: 34, height: 34 }}
          >
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-text no-underline"
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
            className="hidden text-sm font-medium text-text-muted no-underline transition-colors duration-[150ms] ease-in-out hover:text-text md:inline"
          >
            Library
          </Link>

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <MobileMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

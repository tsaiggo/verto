'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 250,
        background: 'var(--bg)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header — matches navbar height */}
      <div
        className="flex shrink-0 items-center justify-end border-b border-border px-5"
        style={{ height: 'var(--navbar-h)' }}
      >
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="grid cursor-pointer place-items-center rounded-[7px] border border-border bg-transparent text-text-muted transition-[background-color,color,border-color] duration-[150ms] ease-in-out hover:bg-bg-muted hover:text-text"
          style={{ width: 34, height: 34 }}
        >
          {/* Close (X) icon */}
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex flex-1 flex-col items-center justify-center gap-8">
        <Link
          href="/read"
          onClick={onClose}
          className="text-2xl font-medium text-text-muted transition-colors duration-[150ms] ease-in-out hover:text-text"
        >
          Library
        </Link>
      </nav>
    </div>
  );
}

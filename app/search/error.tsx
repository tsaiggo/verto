'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Error boundary for the Search & Library route. The index is built from the
 * active content source at request/build time; if that source is unreachable
 * this keeps the failure scoped to the page (preserving the navbar and rail)
 * instead of bubbling to the root boundary and replacing the whole shell.
 */
export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="search-page">
      <div className="search-main">
        <div style={{ maxWidth: 540, paddingTop: 8 }}>
          <h1 className="search-title" style={{ fontSize: 'clamp(24px, 3.5vw, 32px)' }}>
            Search is unavailable
          </h1>
          <p className="search-subtitle" style={{ lineHeight: 1.6 }}>
            The library index couldn&apos;t be built from the connected source.
            It may be offline or misconfigured — try again in a moment.
          </p>
          <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 24 }}>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center font-medium text-white transition-opacity duration-150 hover:opacity-90"
              style={{
                background: 'var(--accent-blue)',
                padding: '9px 24px',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center font-medium no-underline transition-colors duration-150 hover:bg-bg-muted"
              style={{
                border: '1px solid var(--border)',
                padding: '9px 24px',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                color: 'var(--text)',
              }}
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

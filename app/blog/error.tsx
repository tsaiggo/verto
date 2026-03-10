'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function BlogError({
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
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ minHeight: 'calc(100vh - var(--navbar-h))', padding: '40px 20px' }}
    >
      <h1
        className="font-bold"
        style={{ fontSize: 'clamp(72px, 12vw, 120px)', color: 'var(--text-light)', lineHeight: 1, letterSpacing: '-2px' }}
      >
        Error
      </h1>
      <h2
        className="font-semibold"
        style={{ fontSize: 22, color: 'var(--text)', marginTop: 16, letterSpacing: '-0.3px' }}
      >
        Failed to load blog post
      </h2>
      <p
        style={{ fontSize: 16, color: 'var(--text-muted)', marginTop: 8, maxWidth: 420, lineHeight: 1.6 }}
      >
        Something went wrong while loading this blog post. Please try again or return to the home
        page.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 40 }}>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center font-medium text-white transition-opacity duration-150 hover:opacity-90"
          style={{
            background: 'var(--accent-blue)',
            padding: '10px 28px',
            borderRadius: 'var(--radius)',
            fontSize: 15,
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
            padding: '10px 28px',
            borderRadius: 'var(--radius)',
            fontSize: 15,
            color: 'var(--text)',
          }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}

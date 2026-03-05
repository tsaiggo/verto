import type React from 'react';

export default function Toggle({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="toggle">
      <summary>
        <svg
          className="toggle-arrow"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
        {title}
      </summary>
      <div className="toggle-content">{children}</div>
    </details>
  );
}

'use client';

import { type ReactNode } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useInlineComments } from './InlineCommentProvider';

/* ------------------------------------------------------------------ */
/*  InlineCommentRef                                                   */
/*  Clickable annotation marker that shows a popover with the          */
/*  corresponding inline comment content.                              */
/* ------------------------------------------------------------------ */

export default function InlineCommentRef({
  'data-id': dataId,
  children,
}: {
  'data-id'?: string;
  children?: ReactNode;
}) {
  const { comments } = useInlineComments();
  const content = dataId ? comments.get(dataId) : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label="Show author's note"
          style={{ cursor: 'pointer', display: 'inline' }}
        >
          {children}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--accent-blue)',
              verticalAlign: 'super',
              marginLeft: 1,
              opacity: 0.7,
              transition: 'opacity 150ms ease',
            }}
            aria-hidden="true"
          >
            💬
          </span>
        </span>
      </PopoverTrigger>
      {content && (
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[300px] max-w-[340px]"
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--accent-blue)',
              marginBottom: 6,
            }}
          >
            💬 Author&apos;s Note
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{content}</div>
        </PopoverContent>
      )}
    </Popover>
  );
}

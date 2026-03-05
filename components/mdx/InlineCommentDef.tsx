'use client';

import { useEffect, type ReactNode } from 'react';
import { useInlineComments } from './InlineCommentProvider';

/* ------------------------------------------------------------------ */
/*  InlineCommentDef                                                   */
/*  Registers comment content into context on mount.                   */
/*  Renders nothing visible.                                           */
/* ------------------------------------------------------------------ */

export default function InlineCommentDef({
  'data-id': dataId,
  children,
}: {
  'data-id'?: string;
  children?: ReactNode;
}) {
  const { registerComment } = useInlineComments();

  useEffect(() => {
    if (dataId) {
      registerComment(dataId, children);
    }
  }, [dataId, registerComment, children]);

  return null;
}

import type { ReactNode } from 'react';

/**
 * <Steps> — numbered procedure list. Wraps headings (any level) in a flex
 * column with auto-numbered circles. Pure CSS counter, zero JS.
 *
 * ```mdx
 * <Steps>
 *   ### Install
 *   Run `npm install verto`.
 *
 *   ### Configure
 *   Drop your markdown into `content/`.
 * </Steps>
 * ```
 */
export default function Steps({ children }: { children: ReactNode }) {
  return <div className="steps">{children}</div>;
}

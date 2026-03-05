import type React from 'react';

/**
 * InlineCode — styled inline `<code>`.
 * Styling is handled by `.prose code:not(pre code)` in globals.css,
 * so this passthrough ensures the element renders correctly in MDX.
 *
 * When rendered inside a `<pre>` (code blocks), the parent CodeBlock
 * handles presentation — InlineCode just passes through.
 */
export default function InlineCode(
  props: React.ComponentPropsWithoutRef<'code'>,
) {
  return <code {...props} />;
}

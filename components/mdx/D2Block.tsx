'use client';

import D2 from '@/components/mdx/D2';

/**
 * D2Block — adapter for the `<d2-block>` element produced by `rehype-d2`.
 * Reads `data-source` (camelCased to `dataSource` by hast) and forwards
 * it to the real `<D2>` component.
 */
export default function D2Block({ ...props }: Record<string, unknown>) {
  const source =
    (props['dataSource'] as string | undefined) ??
    (props['data-source'] as string | undefined) ??
    '';
  return <D2 chart={source} />;
}

import type React from 'react';

// ── Real MDX block components ────────────────────────────────────────────────
import Callout from '@/components/mdx/Callout';
import Toggle from '@/components/mdx/Toggle';
import TaskList from '@/components/mdx/TaskList';
import Table from '@/components/mdx/Table';
import BlockquoteStyled from '@/components/mdx/BlockquoteStyled';
import BookmarkCard from '@/components/mdx/BookmarkCard';
import Figure from '@/components/mdx/Figure';
import DiagramPlaceholder from '@/components/mdx/DiagramPlaceholder';
import CodeBlock from '@/components/mdx/CodeBlock';
import InlineCode from '@/components/mdx/InlineCode';

// ── Inline comment components (Task 16) ──────────────────────────────────────
import InlineCommentRef from '@/components/mdx/InlineCommentRef';
import InlineCommentDef from '@/components/mdx/InlineCommentDef';

// ---------------------------------------------------------------------------
// MDX Component Map
// Maps HTML element overrides + custom block components for next-mdx-remote.
// ---------------------------------------------------------------------------

export const mdxComponents = {
  // ── HTML element overrides ───────────────────────────────────────────────
  h1: (props: React.ComponentPropsWithoutRef<'h1'>) => <h1 {...props} />,
  h2: (props: React.ComponentPropsWithoutRef<'h2'>) => <h2 {...props} />,
  h3: (props: React.ComponentPropsWithoutRef<'h3'>) => <h3 {...props} />,
  h4: (props: React.ComponentPropsWithoutRef<'h4'>) => <h4 {...props} />,
  p: (props: React.ComponentPropsWithoutRef<'p'>) => <p {...props} />,
  a: (props: React.ComponentPropsWithoutRef<'a'>) => <a {...props} />,
  ul: (props: React.ComponentPropsWithoutRef<'ul'>) => <ul {...props} />,
  ol: (props: React.ComponentPropsWithoutRef<'ol'>) => <ol {...props} />,
  li: (props: React.ComponentPropsWithoutRef<'li'>) => <li {...props} />,
  blockquote: BlockquoteStyled,
  table: Table,
  thead: (props: React.ComponentPropsWithoutRef<'thead'>) => (
    <thead {...props} />
  ),
  tbody: (props: React.ComponentPropsWithoutRef<'tbody'>) => (
    <tbody {...props} />
  ),
  tr: (props: React.ComponentPropsWithoutRef<'tr'>) => <tr {...props} />,
  th: (props: React.ComponentPropsWithoutRef<'th'>) => <th {...props} />,
  td: (props: React.ComponentPropsWithoutRef<'td'>) => <td {...props} />,
  pre: CodeBlock,
  code: InlineCode,
  img: (props: React.ComponentPropsWithoutRef<'img'>) => <img {...props} />,
  hr: (props: React.ComponentPropsWithoutRef<'hr'>) => <hr {...props} />,

  // ── Custom MDX block components ──────────────────────────────────────────
  Callout,
  Toggle,
  TaskList,
  BookmarkCard,
  Figure,
  DiagramPlaceholder,

  // ── Inline comment custom elements (kebab-case from rehype) ──────────────
  'inline-comment-ref': InlineCommentRef,
  'inline-comment-def': InlineCommentDef,
};

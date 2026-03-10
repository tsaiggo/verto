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
// Maps custom block components for next-mdx-remote.
// ---------------------------------------------------------------------------

export const mdxComponents = {
  // ── HTML element overrides (only those with real behavior) ────────────────
  blockquote: BlockquoteStyled,
  table: Table,
  pre: CodeBlock,
  code: InlineCode,

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

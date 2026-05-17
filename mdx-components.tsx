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
import UnknownComponent from '@/components/mdx/UnknownComponent';
import Tabs, { Tab } from '@/components/mdx/Tabs';
import Steps from '@/components/mdx/Steps';
import { Card, CardGroup } from '@/components/mdx/Card';
import { Accordion, AccordionGroup } from '@/components/mdx/Accordion';
import FileTree, { Folder, File } from '@/components/mdx/FileTree';
import Mermaid from '@/components/mdx/Mermaid';
import MermaidBlock from '@/components/mdx/MermaidBlock';
import Excalidraw from '@/components/mdx/Excalidraw';
import ExcalidrawBlock from '@/components/mdx/ExcalidrawBlock';
import Compare from '@/components/mdx/Compare';
import { Timeline, TimelineItem } from '@/components/mdx/Timeline';

// ── Inline comment components ────────────────────────────────────────────────
import InlineCommentRef from '@/components/mdx/InlineCommentRef';
import InlineCommentDef from '@/components/mdx/InlineCommentDef';

// ---------------------------------------------------------------------------
// Known component map. Maps custom block components for next-mdx-remote.
// ---------------------------------------------------------------------------

const knownComponents = {
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
  Tabs,
  Tab,
  Steps,
  Card,
  CardGroup,
  Accordion,
  AccordionGroup,
  FileTree,
  Folder,
  File,
  Mermaid,
  Excalidraw,
  Compare,
  Timeline,
  TimelineItem,

  // ── Inline comment custom elements (kebab-case from rehype) ──────────────
  'inline-comment-ref': InlineCommentRef,
  'inline-comment-def': InlineCommentDef,
  'mermaid-block': MermaidBlock,
  'excalidraw-block': ExcalidrawBlock,
} as const;

// ---------------------------------------------------------------------------
// Component map with safe fallback
//
// Verto is a reader for arbitrary MD/MDX content. To avoid a render crash
// when a document references a component we don't ship (e.g. someone else's
// `<CustomChart />`), unknown JSX names resolve to `UnknownComponent`,
// which displays a friendly placeholder.
//
// Lower-case names (raw HTML elements) fall through to the host element so
// that markup like `<details>`, `<kbd>`, `<sub>` still renders normally.
// ---------------------------------------------------------------------------

const knownKeys = new Set(Object.keys(knownComponents));

export const mdxComponents = new Proxy(
  { ...knownComponents } as Record<string, unknown>,
  {
    get(target, key: string) {
      if (typeof key !== 'string') return undefined;
      if (knownKeys.has(key)) return target[key];
      // Lower-case HTML elements: let MDX render the raw element.
      if (key[0] && key[0] === key[0].toLowerCase()) return undefined;
      // Capitalized → unknown React component → render placeholder.
      return function UnknownTag(props: { children?: React.ReactNode }) {
        return <UnknownComponent name={key}>{props.children}</UnknownComponent>;
      };
    },
    has(_target, key: string) {
      // Always claim ownership of capitalized names so MDX uses our proxy.
      if (typeof key !== 'string') return false;
      if (knownKeys.has(key)) return true;
      return Boolean(key[0]) && key[0] !== key[0].toLowerCase();
    },
  },
) as Record<string, React.ComponentType<unknown>>;

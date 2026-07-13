import { isValidElement, useContext, useEffect, useState } from "react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import { slug as githubSlug } from "github-slugger";

import BlockquoteStyled from "@/components/mdx/BlockquoteStyled";
import BookmarkCard from "@/components/mdx/BookmarkCard";
import Callout from "@/components/mdx/Callout";
import CodeBlock from "@/components/mdx/CodeBlock";
import D2 from "@/components/mdx/D2";
import Excalidraw from "@/components/mdx/Excalidraw";
import Figure from "@/components/mdx/Figure";
import InlineCode from "@/components/mdx/InlineCode";
import Mermaid from "@/components/mdx/Mermaid";
import PackageInstall from "@/components/mdx/PackageInstall";
import Steps from "@/components/mdx/Steps";
import Table from "@/components/mdx/Table";
import MdxTabs, { Tab } from "@/components/mdx/Tabs";
import TaskList, { InteractiveTaskList } from "@/components/mdx/TaskList";
import Toggle from "@/components/mdx/Toggle";
import UnknownComponent from "@/components/mdx/UnknownComponent";
import { Accordion, AccordionGroup } from "@/components/mdx/Accordion";
import { Card, CardGroup } from "@/components/mdx/Card";
import { mergeClassNames, shikiPreProps } from "@/components/runtime/shiki-pre-attrs";
import { getHighlighter, getShikiTransformers } from "@/lib/shiki";
import { RuntimeHeadingSluggerContext } from "@/components/runtime/runtime-heading-context";
import { Button } from "@/components/ui/button";
import { Tabs as UiTabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AccordionRoot,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type AnchorProps = ComponentPropsWithoutRef<"a">;
type ImageProps = ComponentPropsWithoutRef<"img">;
type CodeProps = ComponentPropsWithoutRef<"code"> & { node?: unknown };
type PreProps = ComponentPropsWithoutRef<"pre"> & { node?: unknown };
type HeadingProps = ComponentPropsWithoutRef<"h1">;
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface HighlightedHtml {
  key: string;
  html: string;
}

interface RuntimeCodeBlockProps {
  code: string;
  language?: string | null;
  meta?: string | null;
}

interface RuntimeCodeMetaProps {
  "data-title"?: string;
  "data-line-numbers"?: string;
  "data-no-copy"?: string;
}

// Highlighting a code block with Shiki (Oniguruma WASM) is comparatively
// expensive and produces identical output for identical (language, code)
// pairs. Cache results across renders and across blocks so re-renders and
// repeated snippets are free, and so an already-highlighted block can render
// synchronously on first paint instead of flashing un-highlighted code. The
// key space is naturally bounded by the number of distinct code blocks in the
// documents a reader opens during a session.
const highlightCache = new Map<string, string>();

const DANGEROUS_INTRINSICS = new Set([
  "base",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "portal",
  "script",
  "style",
  "template",
]);

const runtimeComponentEntries = {
  UnknownComponent,
  h1: createRuntimeHeading("h1"),
  h2: createRuntimeHeading("h2"),
  h3: createRuntimeHeading("h3"),
  h4: createRuntimeHeading("h4"),
  h5: createRuntimeHeading("h5"),
  h6: createRuntimeHeading("h6"),
  a: SafeAnchor,
  img: SafeImage,
  blockquote: BlockquoteStyled,
  pre: RuntimePre,
  code: RuntimeCode,
  table: Table,
  ul: InteractiveTaskList,

  Callout,
  Toggle,
  TaskList,
  BookmarkCard,
  Figure,
  Mermaid,
  Excalidraw,
  D2,
  PackageInstall,
  Steps,
  Card,
  CardGroup,
  Accordion,
  AccordionGroup,
  Tabs: MdxTabs,
  Tab,
  InlineCode,

  Button,
  UiTabs,
  UiTabsList: TabsList,
  UiTabsTrigger: TabsTrigger,
  UiTabsContent: TabsContent,
  TabsRoot: UiTabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  Separator,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} as Record<string, unknown>;

export const runtimeComponents = new Proxy(runtimeComponentEntries, {
  get(target, key: string | symbol) {
    if (typeof key !== "string") return undefined;
    if (DANGEROUS_INTRINSICS.has(key)) return DangerousElement;
    if (key in target) return target[key];
    if (key[0] && key[0] === key[0].toLowerCase()) return undefined;
    return UnknownRuntimeComponent(key);
  },
  has(target, key: string | symbol) {
    if (typeof key !== "string") return false;
    if (DANGEROUS_INTRINSICS.has(key)) return true;
    if (key in target) return true;
    return Boolean(key[0]) && key[0] !== key[0].toLowerCase();
  },
}) as Record<string, React.ComponentType<unknown>>;

export function isExplicitRuntimeComponent(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(runtimeComponentEntries, name);
}

function createRuntimeHeading(Tag: HeadingTag) {
  return function RuntimeHeading({ children, id, ...props }: HeadingProps) {
    const slugger = useContext(RuntimeHeadingSluggerContext);
    const headingId =
      id ?? (slugger ? slugger.slug(textFromNode(children)) : githubSlug(textFromNode(children)));

    return (
      <Tag {...props} id={headingId}>
        {children}
      </Tag>
    );
  };
}
export function SafeAnchor({ href, rel, target, children, ...props }: AnchorProps) {
  const safeHref = sanitizeUrl(href);
  if (!safeHref) return <>{children}</>;
  const safeRel = target === "_blank" ? "noreferrer noopener" : rel;
  return (
    <a {...props} href={safeHref} rel={safeRel} target={target}>
      {children}
    </a>
  );
}

export function SafeImage({ src, alt, ...props }: ImageProps) {
  const safeSrc = sanitizeUrl(src);
  if (!safeSrc) return null;
  // Runtime documents come from arbitrary sources; next/image cannot know sizes
  // or optimize remote/local user-selected images ahead of time.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={safeSrc} alt={alt ?? ""} />;
}

export function RuntimeCodeBlock({ code, language = "", meta = "" }: RuntimeCodeBlockProps) {
  const normalizedLanguage = (language ?? "").trim();
  const normalizedMeta = meta ?? "";

  if (isDiagramLanguage(normalizedLanguage)) {
    return <RuntimeDiagram language={normalizedLanguage} source={code} />;
  }

  const children = (
    <code className={normalizedLanguage ? `language-${normalizedLanguage}` : undefined}>
      {code}
    </code>
  );

  return (
    <RuntimeHighlightedPre code={code} language={normalizedLanguage} meta={normalizedMeta}>
      {children}
    </RuntimeHighlightedPre>
  );
}

export function RuntimePre({ children, node, ...props }: PreProps) {
  const code = textFromNode(children);
  const language = languageFromNode(children);
  const { "data-code-meta": rawMeta, ...preProps } = props as PreProps & {
    "data-code-meta"?: string;
  };
  const meta = metaFromPreNode(node) || rawMeta || "";

  if (isDiagramLanguage(language)) {
    return <RuntimeDiagram language={language} source={code} />;
  }

  return (
    <RuntimeHighlightedPre {...preProps} code={code} language={language} meta={meta}>
      {children}
    </RuntimeHighlightedPre>
  );
}

function RuntimeHighlightedPre({
  children,
  code,
  language,
  meta = "",
  ...props
}: PreProps & { code: string; language: string; meta?: string }) {
  const codeBlockProps = {
    ...props,
    ...runtimeCodeMetaProps(meta),
    "data-language": language || undefined,
  } as PreProps & RuntimeCodeMetaProps & { "data-language"?: string };
  const highlightKey = `${language}\n${meta}\n${code}`;
  const [highlightedHtml, setHighlightedHtml] = useState<HighlightedHtml | null>(() => {
    const cached = highlightCache.get(highlightKey);
    return cached ? { key: highlightKey, html: cached } : null;
  });

  useEffect(() => {
    let cancelled = false;
    if (!code.trim()) return;

    // Already highlighted (this block or an identical one earlier this
    // session): reuse the cached HTML without touching the highlighter.
    if (highlightCache.has(highlightKey)) return;

    getHighlighter()
      .then((highlighter) => {
        const html = highlighter.codeToHtml(code, {
          lang: language || "text",
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
          defaultColor: false,
          meta: { __raw: meta },
          transformers: getShikiTransformers(),
        });
        highlightCache.set(highlightKey, html);
        if (!cancelled) setHighlightedHtml({ key: highlightKey, html });
      })
      .catch(() => {
        if (!cancelled)
          setHighlightedHtml((current) => (current?.key === highlightKey ? null : current));
      });

    return () => {
      cancelled = true;
    };
  }, [code, highlightKey, language, meta]);

  // Prefer the cache during render so a cache hit (e.g. when `children` change
  // to a different already-highlighted block) paints highlighted code
  // immediately, before the effect runs.
  let resolvedHtml = highlightCache.get(highlightKey);
  if (resolvedHtml === undefined && highlightedHtml?.key === highlightKey) {
    resolvedHtml = highlightedHtml.html;
  }

  if (resolvedHtml !== undefined) {
    const shikiProps = shikiPreProps(resolvedHtml);
    return (
      <CodeBlock
        {...codeBlockProps}
        className={mergeClassNames(codeBlockProps.className, shikiProps.className)}
        style={{ ...shikiProps.style, ...codeBlockProps.style }}
        dangerouslySetInnerHTML={{ __html: innerPreHtml(resolvedHtml) }}
      />
    );
  }

  return <CodeBlock {...codeBlockProps}>{children}</CodeBlock>;
}
function RuntimeDiagram({ language, source }: { language: string; source: string }) {
  switch (language.toLowerCase()) {
    case "mermaid":
      return <Mermaid chart={source} />;
    case "excalidraw":
      return <Excalidraw scene={source} />;
    case "d2":
      return <D2 chart={source} />;
    default:
      return null;
  }
}

export function RuntimeCode({ className, children, node, ...props }: CodeProps) {
  void node;
  return (
    <code {...props} className={className}>
      {children}
    </code>
  );
}

function DangerousElement({ children }: { children?: ReactNode }) {
  return <UnknownComponent name="UnsafeHtml">{children}</UnknownComponent>;
}

function UnknownRuntimeComponent(name: string) {
  return function RuntimeUnknownTag({ children }: { children?: ReactNode }) {
    return <UnknownComponent name={name}>{children}</UnknownComponent>;
  };
}

export function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return trimmed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return textFromNode(element.props.children);
  }
  return "";
}

function languageFromNode(node: ReactNode): string {
  if (!isValidElement(node)) return "";
  const props = node.props as { className?: unknown };
  if (typeof props.className !== "string") return "";
  const match = /(?:^|\s)language-([^\s]+)/.exec(props.className);
  return match?.[1] ?? "";
}

function metaFromPreNode(node: unknown): string {
  if (!isRecord(node) || !Array.isArray(node.children)) return "";
  for (const child of node.children) {
    if (!isRecord(child) || !isRecord(child.data)) continue;
    if (typeof child.data.meta === "string") return child.data.meta;
  }
  return "";
}

export function runtimeCodeMetaProps(meta: string): RuntimeCodeMetaProps {
  if (!meta) return {};
  const props: RuntimeCodeMetaProps = {};
  const titleMatch = meta.match(/(?:title|filename)\s*=\s*"([^"]+)"/);
  if (titleMatch) props["data-title"] = titleMatch[1];
  if (/\bshowLineNumbers\b/.test(meta)) props["data-line-numbers"] = "true";
  if (/\bnoCopy\b/.test(meta)) props["data-no-copy"] = "true";
  return props;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isDiagramLanguage(language: string): boolean {
  const normalized = language.toLowerCase();
  return normalized === "mermaid" || normalized === "excalidraw" || normalized === "d2";
}

function innerPreHtml(html: string): string {
  const match = /^<pre[^>]*>([\s\S]*)<\/pre>$/.exec(html.trim());
  return match?.[1] ?? html;
}

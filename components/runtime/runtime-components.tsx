import { isValidElement, useEffect, useMemo, useState } from "react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import BlockquoteStyled from "@/components/mdx/BlockquoteStyled";
import BookmarkCard from "@/components/mdx/BookmarkCard";
import Callout from "@/components/mdx/Callout";
import CodeBlock from "@/components/mdx/CodeBlock";
import Figure from "@/components/mdx/Figure";
import InlineCode from "@/components/mdx/InlineCode";
import PackageInstall from "@/components/mdx/PackageInstall";
import Steps from "@/components/mdx/Steps";
import Table from "@/components/mdx/Table";
import MdxTabs, { Tab } from "@/components/mdx/Tabs";
import TaskList from "@/components/mdx/TaskList";
import Toggle from "@/components/mdx/Toggle";
import UnknownComponent from "@/components/mdx/UnknownComponent";
import { Accordion, AccordionGroup } from "@/components/mdx/Accordion";
import { Card, CardGroup } from "@/components/mdx/Card";
import { getHighlighter } from "@/lib/shiki";
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

interface HighlightedHtml {
  key: string;
  html: string;
}

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
  a: SafeAnchor,
  img: SafeImage,
  blockquote: BlockquoteStyled,
  pre: RuntimePre,
  code: RuntimeCode,
  table: Table,

  Callout,
  Toggle,
  TaskList,
  BookmarkCard,
  Figure,
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

export function RuntimePre({ children, node, ...props }: PreProps) {
  void node;
  const code = useMemo(() => textFromNode(children), [children]);
  const language = useMemo(() => languageFromNode(children), [children]);
  const highlightKey = `${language}\n${code}`;
  const [highlightedHtml, setHighlightedHtml] = useState<HighlightedHtml | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!code.trim()) return;

    getHighlighter()
      .then((highlighter) => {
        const html = highlighter.codeToHtml(code, {
          lang: language || "text",
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
          defaultColor: false,
        });
        if (!cancelled) setHighlightedHtml({ key: highlightKey, html });
      })
      .catch(() => {
        if (!cancelled)
          setHighlightedHtml((current) => (current?.key === highlightKey ? null : current));
      });

    return () => {
      cancelled = true;
    };
  }, [code, highlightKey, language]);

  if (highlightedHtml?.key === highlightKey) {
    const shikiProps = {
      ...props,
      "data-language": language || undefined,
      dangerouslySetInnerHTML: { __html: innerPreHtml(highlightedHtml.html) },
    } satisfies PreProps & {
      "data-language"?: string;
      dangerouslySetInnerHTML: { __html: string };
    };
    return <CodeBlock {...shikiProps} />;
  }

  return (
    <CodeBlock {...props} data-language={language || undefined}>
      {children}
    </CodeBlock>
  );
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

function innerPreHtml(html: string): string {
  const match = /^<pre[^>]*>([\s\S]*)<\/pre>$/.exec(html.trim());
  return match?.[1] ?? html;
}

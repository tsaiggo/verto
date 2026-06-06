'use client';

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Tabs as TabsRoot,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface TabProps {
  label: string;
  value?: string;
  children: ReactNode;
}

/**
 * <Tab> — single tab pane. Used purely as a config carrier; <Tabs>
 * reads its props and renders via Radix `<TabsContent>`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Tab(_props: TabProps): null {
  return null;
}

function isTabElement(node: ReactNode): node is ReactElement<TabProps> {
  if (!isValidElement<Partial<TabProps>>(node)) return false;
  return typeof node.props.label === 'string';
}

interface TabsProps {
  children: ReactNode;
  /** Optional URL hash key, e.g. `id="install"` syncs with `#install=npm` */
  id?: string;
  /** Default tab value (matches `<Tab value>` or label) */
  defaultValue?: string;
}

/**
 * <Tabs> — accessible tablist built on Radix `Tabs` with an optional
 * URL-hash binding so deep links land on a specific tab.
 *
 * ```mdx
 * <Tabs id="install">
 *   <Tab label="npm">…</Tab>
 *   <Tab label="pnpm">…</Tab>
 * </Tabs>
 * ```
 */
export default function Tabs({ children, id, defaultValue }: TabsProps) {
  const tabs = Children.toArray(children)
    .filter(isTabElement)
    .map((el) => ({
      label: el.props.label,
      value: el.props.value ?? slugify(el.props.label),
      content: el.props.children,
    }));

  const initial =
    (defaultValue && tabs.find((t) => t.value === defaultValue)?.value) ??
    tabs[0]?.value ??
    '';
  const [active, setActive] = useState(initial);
  const groupId = useId();

  // Hash sync (read on mount + listen for changes), avoids hydration mismatch
  // by deferring the read until the client effect runs.
  useEffect(() => {
    if (!id) return;
    const read = () => {
      const m = window.location.hash.match(
        new RegExp(`(?:^|[#&])${escape(id)}=([^&]+)`),
      );
      const v = m ? decodeURIComponent(m[1]) : null;
      if (v && tabs.some((t) => t.value === v)) setActive(v);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (tabs.length === 0) return null;

  return (
    <TabsRoot
      value={active}
      onValueChange={setActive}
      className="tabs"
      id={groupId}
    >
      <TabsList className="tabs-list" aria-label="Tabs">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="tabs-tab">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="tabs-panel">
          {t.content}
        </TabsContent>
      ))}
    </TabsRoot>
  );
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

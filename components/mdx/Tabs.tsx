'use client';

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

interface TabProps {
  label: string;
  value?: string;
  children: ReactNode;
}

/**
 * <Tab> — single tab pane. Must be used inside <Tabs>.
 * Used purely as a config carrier; <Tabs> reads its props and renders.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Tab(_props: TabProps): null {
  return null;
}

interface TabsProps {
  children: ReactNode;
  /** Optional URL hash key, e.g. `id="install"` syncs with `#install=npm` */
  id?: string;
  /** Default tab value (matches `<Tab value>` or label) */
  defaultValue?: string;
}

/**
 * <Tabs> — accessible tablist with arrow-key navigation and an optional
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
    .filter((c): c is ReactElement<TabProps> => isValidElement(c) && c.type === Tab)
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')
      return;
    e.preventDefault();
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    setActive(tabs[next].value);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="tabs">
      <div role="tablist" aria-label="Tabs" className="tabs-list">
        {tabs.map((t, i) => {
          const selected = t.value === active;
          return (
            <button
              key={t.value}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${groupId}-panel-${i}`}
              id={`${groupId}-tab-${i}`}
              tabIndex={selected ? 0 : -1}
              className={`tabs-tab${selected ? ' is-active' : ''}`}
              onClick={() => setActive(t.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.value}
          role="tabpanel"
          id={`${groupId}-panel-${i}`}
          aria-labelledby={`${groupId}-tab-${i}`}
          hidden={t.value !== active}
          className="tabs-panel"
        >
          {t.content}
        </div>
      ))}
    </div>
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

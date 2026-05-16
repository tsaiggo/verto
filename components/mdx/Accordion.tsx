'use client';

import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';

interface AccordionProps {
  title: string;
  children: ReactNode;
  /** Optional initial state (standalone Accordion only) */
  defaultOpen?: boolean;
  /** Internal: set by <AccordionGroup>; renders as a bare Item */
  __value?: string;
}

function Arrow() {
  return (
    <svg
      className="toggle-arrow"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function AccordionPanel({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionPrimitive.Item value={value} className="accordion">
      <AccordionPrimitive.Header className="m-0">
        <AccordionPrimitive.Trigger className="accordion-trigger">
          <Arrow />
          <span>{title}</span>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="accordion-content">
        {children}
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

/**
 * <Accordion> — single collapsible panel built on Radix Accordion.
 *
 * Standalone, this renders a self-contained accordion root. When wrapped in
 * <AccordionGroup>, the group owns the root and this component just renders
 * the item.
 *
 * Markup preserves the original `.accordion` / `.accordion-content` class
 * hooks for backwards-compatible styling.
 */
export function Accordion({
  title,
  children,
  defaultOpen,
  __value,
}: AccordionProps) {
  if (__value !== undefined) {
    return (
      <AccordionPanel value={__value} title={title}>
        {children}
      </AccordionPanel>
    );
  }
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? 'item' : undefined}
    >
      <AccordionPanel value="item" title={title}>
        {children}
      </AccordionPanel>
    </AccordionPrimitive.Root>
  );
}

interface AccordionGroupProps {
  /** Only one panel may be open at a time */
  exclusive?: boolean;
  children: ReactNode;
}

/**
 * <AccordionGroup> — wraps multiple <Accordion>. When `exclusive`, opening
 * one closes the others (Radix `type="single"`); otherwise multiple may be
 * open at once (`type="multiple"`).
 */
export function AccordionGroup({ exclusive, children }: AccordionGroupProps) {
  const items = useMemo(
    () =>
      Children.toArray(children).filter(
        (c): c is ReactElement<AccordionProps> =>
          isValidElement(c) && c.type === Accordion,
      ),
    [children],
  );

  const initial = items
    .map((it, i) => (it.props.defaultOpen ? `item-${i}` : null))
    .filter((v): v is string => v !== null);

  if (exclusive) {
    return <SingleGroup items={items} initial={initial[0] ?? ''} />;
  }
  return <MultipleGroup items={items} initial={initial} />;
}

function SingleGroup({
  items,
  initial,
}: {
  items: ReactElement<AccordionProps>[];
  initial: string;
}) {
  const [value, setValue] = useState<string>(initial);
  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      value={value}
      onValueChange={setValue}
      className="accordion-group"
    >
      {items.map((item, i) => (
        <AccordionPanel key={i} value={`item-${i}`} title={item.props.title}>
          {item.props.children}
        </AccordionPanel>
      ))}
    </AccordionPrimitive.Root>
  );
}

function MultipleGroup({
  items,
  initial,
}: {
  items: ReactElement<AccordionProps>[];
  initial: string[];
}) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <AccordionPrimitive.Root
      type="multiple"
      value={value}
      onValueChange={setValue}
      className="accordion-group"
    >
      {items.map((item, i) => (
        <AccordionPanel key={i} value={`item-${i}`} title={item.props.title}>
          {item.props.children}
        </AccordionPanel>
      ))}
    </AccordionPrimitive.Root>
  );
}

export default Accordion;

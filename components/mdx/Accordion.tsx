'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

interface AccordionProps {
  title: string;
  children: ReactNode;
  /** Optional initial state */
  defaultOpen?: boolean;
  /** Internal: controlled state from <AccordionGroup exclusive> */
  open?: boolean;
  onToggle?: (next: boolean) => void;
}

/**
 * <Accordion> — single collapsible panel built on `<details>` so it
 * degrades gracefully without JS. When wrapped in `<AccordionGroup exclusive>`
 * the parent group controls the open state to enforce only-one-at-a-time.
 */
export function Accordion({
  title,
  children,
  defaultOpen,
  open,
  onToggle,
}: AccordionProps) {
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const isOpen = isControlled ? open : uncontrolledOpen;

  return (
    <details
      className="accordion"
      open={isOpen}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        if (next === isOpen) return;
        if (isControlled) onToggle?.(next);
        else setUncontrolledOpen(next);
      }}
    >
      <summary>
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
        <span>{title}</span>
      </summary>
      <div className="accordion-content">{children}</div>
    </details>
  );
}

interface AccordionGroupProps {
  /** Only one panel may be open at a time */
  exclusive?: boolean;
  children: ReactNode;
}

/**
 * <AccordionGroup> — wraps multiple <Accordion>. When `exclusive`, opening
 * one closes the others.
 */
export function AccordionGroup({ exclusive, children }: AccordionGroupProps) {
  const items = Children.toArray(children).filter(
    (c): c is ReactElement<AccordionProps> =>
      isValidElement(c) && c.type === Accordion,
  );
  const [openIndex, setOpenIndex] = useState<number | null>(() =>
    items.findIndex((it) => it.props.defaultOpen) >= 0
      ? items.findIndex((it) => it.props.defaultOpen)
      : null,
  );

  if (!exclusive) {
    return <div className="accordion-group">{children}</div>;
  }

  return (
    <div className="accordion-group">
      {items.map((item, i) =>
        cloneElement(item, {
          key: i,
          open: openIndex === i,
          onToggle: (next: boolean) => setOpenIndex(next ? i : null),
        }),
      )}
    </div>
  );
}

export default Accordion;

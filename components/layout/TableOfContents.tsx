"use client";

import { useEffect, useState } from "react";
import type { TOCItem } from "@/lib/types";

interface TableOfContentsProps {
  items: TOCItem[];
}

export default function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0px 0px -80% 0px", threshold: 0 }
    );

    const elements: Element[] = [];
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    }

    return () => {
      for (const el of elements) {
        observer.unobserve(el);
      }
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Table of Contents"
      className="hidden xl:block shrink-0 sticky overflow-y-auto"
      style={{
        width: "var(--toc-w)",
        top: "calc(var(--navbar-h) + 20px)",
        height: "fit-content",
        maxHeight: "calc(100vh - var(--navbar-h) - 40px)",
        padding: "0",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border) transparent",
      }}
    >
      <p
        className="text-text-muted"
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "8px",
        }}
      >
        On this page
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={
                  isActive
                    ? "text-accent-blue"
                    : "text-text-muted hover:text-text"
                }
                style={{
                  display: "block",
                  padding: "4px 0",
                  paddingLeft: item.level === 3 ? "12px" : undefined,
                  fontSize: "13px",
                  lineHeight: 1.5,
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: "none",
                  transition: "color 150ms ease",
                }}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

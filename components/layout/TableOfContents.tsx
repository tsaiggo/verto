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
    <nav aria-label="Table of Contents">
      <p className="toc-label">
        On this page
      </p>

      <ul className="toc-list">
        {items.map((item) => {
          const isActive = activeId === item.id;
          const depthClass = item.level === 4
            ? " depth-4"
            : item.level === 3
              ? " depth-3"
              : "";
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`toc-link${depthClass}${isActive ? " is-active" : ""}`}
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

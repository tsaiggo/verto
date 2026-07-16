"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText } from "lucide-react";
import type { TOCItem } from "@/lib/types";

interface TableOfContentsProps {
  items: TOCItem[];
  title?: string;
  label?: string;
}

function hashId(): string {
  if (typeof window === "undefined") return "";
  const value = window.location.hash.slice(1);
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function TableOfContents({
  items,
  title,
  label = "Contents",
}: TableOfContentsProps) {
  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const [activeId, setActiveId] = useState(() => items[0]?.id ?? "");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (items.length === 0) return;

    const targets = items.flatMap((item) => {
      const element = document.getElementById(item.id);
      return element ? [{ element, id: item.id }] : [];
    });
    if (targets.length === 0) return;

    const scrollRoot = targets[0].element.closest<HTMLElement>("[data-page-scroll]");
    const updateFromLayout = () => {
      const rootRect = scrollRoot?.getBoundingClientRect();
      const rootTop = rootRect?.top ?? 0;
      const rootHeight = rootRect?.height ?? window.innerHeight;
      const activationLine = rootTop + Math.min(96, rootHeight * 0.22);
      let nextId = targets[0].id;

      const isAtEnd = scrollRoot
        ? scrollRoot.scrollHeight > scrollRoot.clientHeight &&
          scrollRoot.scrollTop + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 2
        : document.documentElement.scrollHeight > window.innerHeight &&
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (isAtEnd) {
        setActiveId(targets.at(-1)?.id ?? nextId);
        return;
      }

      for (const target of targets) {
        if (target.element.getBoundingClientRect().top <= activationLine) nextId = target.id;
        else break;
      }
      setActiveId(nextId);
    };

    let frame = 0;
    const scheduleLayoutUpdate = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateFromLayout();
      });
    };

    const onHashChange = () => {
      const nextId = hashId();
      if (itemIds.has(nextId)) setActiveId(nextId);
    };
    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;
    scrollTarget.addEventListener("scroll", scheduleLayoutUpdate, { passive: true });
    window.addEventListener("resize", scheduleLayoutUpdate, { passive: true });
    window.addEventListener("hashchange", onHashChange);
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      const currentHash = hashId();
      if (currentHash && itemIds.has(currentHash)) setActiveId(currentHash);
      else updateFromLayout();
    });

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      scrollTarget.removeEventListener("scroll", scheduleLayoutUpdate);
      window.removeEventListener("resize", scheduleLayoutUpdate);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [itemIds, items]);

  const resolvedActiveId = itemIds.has(activeId) ? activeId : (items[0]?.id ?? "");

  useEffect(() => {
    const activeLink = navRef.current?.querySelector<HTMLAnchorElement>(
      '.toc-link[aria-current="location"]'
    );
    activeLink?.scrollIntoView?.({ block: "nearest" });
  }, [resolvedActiveId]);

  if (items.length === 0) return null;

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === resolvedActiveId)
  );

  return (
    <nav ref={navRef} className="article-toc" aria-label="Table of contents">
      <div className="article-toc-heading">
        <p className="toc-label">{label}</p>
        <span className="article-toc-position">
          {activeIndex + 1} of {items.length}
        </span>
      </div>

      {title ? (
        <div className="article-toc-document">
          <BookOpenText aria-hidden />
          <strong title={title}>{title}</strong>
        </div>
      ) : null}

      <div className="article-toc-scroll">
        <ol className="toc-list">
          {items.map((item) => {
            const isActive = resolvedActiveId === item.id;
            const depthClass = item.level > 2 ? ` depth-${Math.min(item.level, 6)}` : "";
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={`toc-link${depthClass}${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "location" : undefined}
                  onClick={() => setActiveId(item.id)}
                >
                  {item.text}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

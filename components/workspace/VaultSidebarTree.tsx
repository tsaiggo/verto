"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Folder, Pin, PinOff } from "lucide-react";
import type { RuntimeLocalIndexedDocument } from "@/lib/runtime-local-index";
import { ROOT_FILES_KEY, type VaultSidebarFolder } from "./VaultSidebarData";

const iconProps = { size: 15, strokeWidth: 1.65 } as const;

interface VaultSidebarTreeProps {
  activeFileId: string | null | undefined;
  tree: readonly VaultSidebarFolder[];
  forcedOpen: boolean;
  hrefForDocument: (document: RuntimeLocalIndexedDocument) => string;
  onOpenDocument: (fileId: string) => void;
  onTogglePin: (fileId: string) => void;
  pinnedFileIds: readonly string[];
}

/** Renders the local MD/MDX hierarchy emitted by `buildVaultSidebarTree`. */
export function VaultSidebarTree({ tree, ...props }: VaultSidebarTreeProps) {
  return (
    <nav aria-label="Local library page tree" className="mt-1">
      <ul className="space-y-0.5">
        {tree.map((folder) => (
          <TreeFolder
            key={folder.id}
            depth={0}
            folder={folder}
            rootFolder={folder.id === ROOT_FILES_KEY}
            {...props}
          />
        ))}
      </ul>
    </nav>
  );
}

function TreeFolder({
  activeFileId,
  depth,
  folder,
  forcedOpen,
  hrefForDocument,
  onOpenDocument,
  onTogglePin,
  pinnedFileIds,
  rootFolder = false,
}: Omit<VaultSidebarTreeProps, "tree"> & {
  depth: number;
  folder: VaultSidebarFolder;
  rootFolder?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const open = rootFolder || forcedOpen || isOpen;

  return (
    <li>
      {!rootFolder ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setIsOpen((current) => !current)}
          className="group flex h-8 w-full items-center gap-1.5 rounded-lg px-2 text-left text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <ChevronRight
            {...iconProps}
            aria-hidden
            className={joinClasses("shrink-0 transition-transform", open && "rotate-90")}
          />
          <Folder {...iconProps} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
          <span className="truncate">{folder.name}</span>
        </button>
      ) : null}
      {open ? (
        <ul
          className={joinClasses(
            "space-y-0.5",
            rootFolder ? "" : "ml-[15px] border-l border-[var(--border-soft)] pl-1"
          )}
        >
          {folder.documents.map((document) => (
            <VaultSidebarDocumentRow
              key={document.entry.id}
              active={activeFileId === document.entry.id}
              document={document}
              href={hrefForDocument(document)}
              nested={!rootFolder}
              onOpen={onOpenDocument}
              onTogglePin={onTogglePin}
              pinned={pinnedFileIds.includes(document.entry.id)}
            />
          ))}
          {folder.folders.map((child) => (
            <TreeFolder
              key={child.id}
              activeFileId={activeFileId}
              depth={rootFolder ? depth : depth + 1}
              folder={child}
              forcedOpen={forcedOpen}
              hrefForDocument={hrefForDocument}
              onOpenDocument={onOpenDocument}
              onTogglePin={onTogglePin}
              pinnedFileIds={pinnedFileIds}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function VaultSidebarDocumentRow({
  active,
  document,
  href,
  nested = false,
  onOpen,
  onTogglePin,
  pinned,
}: {
  active: boolean;
  document: RuntimeLocalIndexedDocument;
  href: string;
  nested?: boolean;
  onOpen: (fileId: string) => void;
  onTogglePin: (fileId: string) => void;
  pinned: boolean;
}) {
  const pinLabel = pinned ? `Unpin ${document.node.title}` : `Pin ${document.node.title}`;
  const handlePin = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onTogglePin(document.entry.id);
  };

  return (
    <li className="group flex min-w-0 items-center gap-0.5">
      <Link
        aria-current={active ? "page" : undefined}
        className={joinClasses(
          "flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 text-[13px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]",
          nested && "pl-2.5",
          active
            ? "bg-[var(--bg-muted)] font-medium text-[var(--text)]"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
        )}
        href={href}
        onClick={() => onOpen(document.entry.id)}
        prefetch={false}
        title={document.entry.path.join("/")}
      >
        <FileText
          {...iconProps}
          aria-hidden
          className={joinClasses(
            "shrink-0",
            active ? "text-[var(--text)]" : "text-[var(--text-muted)]"
          )}
        />
        <span className="truncate">{document.node.title}</span>
      </Link>
      <button
        type="button"
        onClick={handlePin}
        aria-label={pinLabel}
        title={pinLabel}
        className={joinClasses(
          "grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]",
          pinned
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        )}
      >
        {pinned ? <Pin {...iconProps} aria-hidden /> : <PinOff {...iconProps} aria-hidden />}
      </button>
    </li>
  );
}

function joinClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

interface FileTreeProps {
  children: ReactNode;
}

interface FolderProps {
  name: string;
  children?: ReactNode;
  /** When `true`, renders open chevron. Pure visual hint — no interaction. */
  defaultOpen?: boolean;
}

interface FileProps {
  name: string;
  /** Optional comment shown to the right in muted color */
  comment?: string;
}

/**
 * <FileTree> — static directory layout illustration.
 *
 * ```mdx
 * <FileTree>
 *   <Folder name="content" defaultOpen>
 *     <Folder name="docs">
 *       <File name="intro.md" />
 *     </Folder>
 *     <File name="navigation.json" comment="optional overrides" />
 *   </Folder>
 * </FileTree>
 * ```
 *
 * Renders as a monospace list with connector glyphs (└─ / ├─) for clarity.
 */
export default function FileTree({ children }: FileTreeProps) {
  return (
    <div className="file-tree">
      <ul>{renderEntries(children)}</ul>
    </div>
  );
}

export function Folder({ name, children, defaultOpen = true }: FolderProps) {
  // Note: this is a server-renderable component; `defaultOpen` is just a
  // visual hint that controls the chevron orientation.
  return (
    <li>
      <span className="file-tree-row file-tree-folder">
        <span className="file-tree-icon" aria-hidden="true">
          {defaultOpen ? "▾" : "▸"}
        </span>
        <span className="file-tree-name">{name}/</span>
      </span>
      {children && <ul>{renderEntries(children)}</ul>}
    </li>
  );
}

export function File({ name, comment }: FileProps) {
  return (
    <li>
      <span className="file-tree-row">
        <span className="file-tree-icon" aria-hidden="true">
          ·
        </span>
        <span className="file-tree-name">{name}</span>
        {comment && <span className="file-tree-comment"> - {comment}</span>}
      </span>
    </li>
  );
}

function renderEntries(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return null;
    return child as ReactElement;
  });
}

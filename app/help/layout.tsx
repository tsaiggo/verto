/**
 * Layout shared by every Help page. As in the reader layout, the file-tree
 * navigation lives in the global application rail (see `AppShell`), which is
 * mounted once in the root layout and shows the user Library — Help is reached
 * through the rail's persistent "Help" link, not a second tree. Here we just
 * wrap each page's content + right rail (`.main` / `.toc-sidebar`).
 */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs-layout">
      {children}
    </div>
  );
}

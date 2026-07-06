/**
 * Layout shared by every reader page. The file-tree navigation lives in the
 * global application rail (see `AppShell`); here we just wrap each page's
 * content + right rail (`.main` / `.toc-sidebar`).
 */
export default function ReadLayout({ children }: { children: React.ReactNode }) {
  return <div className="docs-layout read-layout">{children}</div>;
}

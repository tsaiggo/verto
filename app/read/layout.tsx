import ReadingProgress from "@/components/reader/ReadingProgress";
import SelectionShareProvider from "@/components/ui/SelectionShareProvider";

/**
 * Layout shared by every reader page. The file-tree navigation lives in the
 * global application rail (see `AppShell`); here we only add the thin
 * reading-progress indicator and let each page render its content + right
 * rail (`.main` / `.toc-sidebar`).
 */
export default function ReadLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelectionShareProvider>
      <div className="docs-layout">
        <ReadingProgress />
        {children}
      </div>
    </SelectionShareProvider>
  );
}

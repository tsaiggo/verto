import type { ComponentPropsWithoutRef, ReactNode } from "react";

type MainProps = Omit<ComponentPropsWithoutRef<"section">, "children" | "className">;
type ContextProps = Omit<ComponentPropsWithoutRef<"aside">, "children" | "className">;

interface ReaderFrameProps {
  children: ReactNode;
  mainLabel: string;
  mainProps?: MainProps;
  context?: ReactNode;
  contextProps?: ContextProps;
  tabs?: ReactNode;
  chat?: ReactNode;
}

/**
 * Shared document-workspace anatomy.
 *
 * The surrounding route layout remains the `.docs-layout` owner so tabs and
 * the companion stay direct children of that grid. Every reader state then
 * uses one scroll owner and one workbench, with the context rail omitted when
 * it has no meaningful content.
 */
export default function ReaderFrame({
  children,
  mainLabel,
  mainProps,
  context,
  contextProps,
  tabs,
  chat,
}: ReaderFrameProps) {
  const hasContext = context !== undefined && context !== null && context !== false;
  const hasTabs = tabs !== undefined && tabs !== null && tabs !== false;

  return (
    <>
      {tabs}
      <div
        className="reader-scroll"
        data-page-scroll
        data-reader-tabs={hasTabs ? "present" : "absent"}
      >
        <div className={`reader-workbench${hasContext ? "" : " is-single-column"}`}>
          <section {...mainProps} className="main" aria-label={mainLabel}>
            {children}
          </section>
          {hasContext ? (
            <aside {...contextProps} className="toc-rail" data-context-panel>
              {context}
            </aside>
          ) : null}
        </div>
      </div>
      {chat}
    </>
  );
}

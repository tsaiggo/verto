import type { Metadata } from "next";
import Link from "next/link";
import { WorkspacePreview } from "@/components/design-labs/workspace-sidebar/Preview";
import { FlowPreview } from "@/components/design-labs/flow-sidebar/Preview";
import { BookDiscoveryPreview } from "@/components/design-labs/book-discovery/Preview";

export const metadata: Metadata = {
  title: "Labs Preview",
  robots: { index: false, follow: false },
};

type SearchParams = { exp?: string };

const EXPS = [
  { id: "workspace", label: "Workspace" },
  { id: "flow", label: "Flow" },
  { id: "books", label: "Books" },
] as const;

type ExpId = (typeof EXPS)[number]["id"];

function isValidExp(v: string | undefined): v is ExpId {
  return v === "workspace" || v === "flow" || v === "books";
}

export default async function LabsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const raw = params?.exp;
  const active: ExpId = isValidExp(raw) ? raw : "workspace";

  return (
    <>
      {/* Design-labs styles - :where-scoped, safe to include together. Active-only also fine. */}
      <link rel="stylesheet" href="/design-labs/workspace-sidebar/styles.css" />
      <link rel="stylesheet" href="/design-labs/flow-sidebar/styles.css" />
      <link rel="stylesheet" href="/design-labs/book-discovery/styles.css" />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            color: "#9aa0a8",
            fontWeight: 600,
            marginRight: 8,
          }}
        >
          LABS PREVIEW
        </span>
        {EXPS.map((exp) => {
          const isActive = exp.id === active;
          return (
            <Link
              key={exp.id}
              href={`/labs?exp=${exp.id}`}
              aria-current={isActive ? "page" : undefined}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? "#111827" : "#f3f4f6",
                color: isActive ? "#fff" : "#374151",
                textDecoration: "none",
                border: isActive ? "1px solid #111827" : "1px solid transparent",
              }}
            >
              {exp.label}
            </Link>
          );
        })}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "#9aa0a8",
          }}
        >
          preview only — mock data
        </span>
      </div>

      <div style={{ minHeight: "calc(100dvh - 44px)" }}>
        {active === "workspace" && <WorkspacePreview />}
        {active === "flow" && <FlowPreview />}
        {active === "books" && <BookDiscoveryPreview />}
      </div>
    </>
  );
}

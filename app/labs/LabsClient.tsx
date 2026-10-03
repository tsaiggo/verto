"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkspacePreview } from "@/components/design-labs/workspace-sidebar/Preview";
import { FlowPreview } from "@/components/design-labs/flow-sidebar/Preview";
import { BookDiscoveryPreview } from "@/components/design-labs/book-discovery/Preview";

const EXPS = [
  { id: "workspace", label: "Workspace" },
  { id: "flow", label: "Flow" },
  { id: "books", label: "Books" },
] as const;

type ExpId = (typeof EXPS)[number]["id"];

function isValidExp(value: string | undefined): value is ExpId {
  return value === "workspace" || value === "flow" || value === "books";
}

export default function LabsClient() {
  const values = useSearchParams()?.getAll("exp") ?? [];
  // The former server route also fell back for missing or repeated values.
  const raw = values.length === 1 ? values[0] : undefined;
  const active: ExpId = isValidExp(raw) ? raw : "workspace";

  return (
    <>
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

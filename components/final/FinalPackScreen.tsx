import Link from "next/link";
import type { ReactNode } from "react";
import { FINAL_PACK_ITEMS, type FinalPackItem } from "@/components/final/final-pack-data";
import { Header, isEditor, isReader } from "@/components/final/final-primitives";
import { specialReferenceSurface } from "@/components/final/final-reference-surfaces";
import { KnowledgeSurface, ReaderSurface } from "@/components/final/final-surfaces-library";
import { EditorSurface } from "@/components/final/final-surfaces-editor";
import { AgentSurface } from "@/components/final/final-surfaces-agent";
import { SourcesSurface } from "@/components/final/final-surfaces-sources";
import { SettingsSurface, StateSurface } from "@/components/final/final-surfaces-ops";
import { FoundationSurface, GenericSurface } from "@/components/final/final-surfaces-foundation";

export default function FinalPackScreen({
  item,
  showRelated = true,
}: {
  item: FinalPackItem;
  showRelated?: boolean;
}) {
  const special = specialReferenceSurface(item);
  if (special) {
    return (
      <main className="final-page final-page-reference" aria-label={item.title}>
        {special}
      </main>
    );
  }

  let body: ReactNode;
  if (isReader(item)) body = <ReaderSurface item={item} />;
  else if (isEditor(item)) body = <EditorSurface item={item} />;
  else if (item.category === "Agent") body = <AgentSurface item={item} />;
  else if (item.category === "Sources & Git") body = <SourcesSurface item={item} />;
  else if (item.category === "Settings") body = <SettingsSurface item={item} />;
  else if (item.category === "Onboarding & States") body = <StateSurface item={item} />;
  else if (
    item.category === "Foundation" ||
    item.category === "Responsive" ||
    item.category === "Mobile"
  )
    body = <FoundationSurface item={item} />;
  else if (item.category === "Library & Knowledge") body = <KnowledgeSurface item={item} />;
  else body = <GenericSurface item={item} />;

  return (
    <main className="final-page" aria-label={item.title}>
      {body}
      {showRelated && !["Reader", "Editor", "Agent"].includes(item.category) ? null : null}
    </main>
  );
}

export function FinalPackIndex() {
  const groups = Array.from(new Set(FINAL_PACK_ITEMS.map((item) => item.category)));
  return (
    <main className="final-page final-index">
      <Header
        item={{
          id: "final-index",
          title: "Final Implementation Pack",
          category: "Coverage",
          state: "92 references",
          sourceBoard: "00-07",
          notes: "Every reference screen has a route-backed Verto surface for final verification.",
        }}
      />
      {groups.map((group) => (
        <section key={group} className="final-index-group">
          <h2>{group}</h2>
          <div className="final-index-grid">
            {FINAL_PACK_ITEMS.filter((item) => item.category === group).map((item) => (
              <Link key={item.id} href={`/final/${item.id}`} className="final-index-card">
                <span>{item.id.split("_")[0]}</span>
                <strong>{item.title}</strong>
                <small>{item.state}</small>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

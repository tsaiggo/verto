import PageHeader from "@/components/layout/PageHeader";
import EditorClient from "./EditorClient";

// ---------------------------------------------------------------------------
// Editor page (/editor?slug=<slug> or /editor for a new file)
//
// Thin server shell: reads the `slug` search-param and hands it to the
// client-side EditorClient, which handles file loading, editing, and
// saving (desktop) / downloading (web).
//
// The decorative "Saved" badge from the previous static mock is removed.
// The editor shows an honest save status only after a real write completes
// on the desktop, or triggers a browser download on the web.
// ---------------------------------------------------------------------------

export const metadata = { title: "Editor" };

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  return (
    <>
      <PageHeader title="Editor" subtitle="MDX authoring with source and preview." />
      <EditorClient slug={slug} />
    </>
  );
}

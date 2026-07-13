import PageHeader from "@/components/layout/PageHeader";
import EditorClient from "./EditorClient";

// ---------------------------------------------------------------------------
// Editor page (/editor?slug=<slug> or /editor for a new file)
//
// Static shell: query-string handling lives in the client so Tauri / Next
// static export can pre-render this page without dynamic server rendering.
// ---------------------------------------------------------------------------

export const metadata = { title: "Editor" };

export default function EditorPage() {
  return (
    <>
      <PageHeader
        title="Editor"
        subtitle="Write portable MDX, preview it, then save it to your library or download it."
      />
      <EditorClient />
    </>
  );
}

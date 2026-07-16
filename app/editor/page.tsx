import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import EditorClient from "./EditorClient";
import styles from "./EditorClient.module.css";

// ---------------------------------------------------------------------------
// Editor page (/editor?slug=<slug> or /editor for a new file)
//
// Static shell: query-string handling lives in the client so Tauri / Next
// static export can pre-render this page without dynamic server rendering.
// ---------------------------------------------------------------------------

export const metadata = { title: "Editor" };

export default function EditorPage() {
  return (
    <ContentPage width="wide" innerClassName={styles.pageInner}>
      <ContentHeader
        title="Editor"
        description="Write portable Markdown or MDX, preview it with the Reader type system, then save or export it."
      />
      <EditorClient />
    </ContentPage>
  );
}

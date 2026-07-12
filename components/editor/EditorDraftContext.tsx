import { FilePenLine } from "lucide-react";

export default function EditorDraftContext({
  isDesktop,
  isExistingFile,
}: {
  isDesktop: boolean;
  isExistingFile: boolean;
}) {
  const title = isDesktop
    ? isExistingFile
      ? "Editing a local MDX file"
      : "New local MDX draft"
    : "Portable MDX draft";
  const description = isDesktop
    ? "Save writes this document to your selected local library."
    : "Preview your work, then download a portable .mdx file you can add to any library.";

  return (
    <aside className="ed-draft-context" aria-label="Draft storage">
      <FilePenLine aria-hidden />
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </aside>
  );
}

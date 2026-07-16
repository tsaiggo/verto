import { FilePenLine } from "lucide-react";
import { ContentStatus } from "@/components/ui/content-primitives";

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
    <ContentStatus
      className="ed-draft-context"
      aria-label="Draft storage"
      icon={<FilePenLine aria-hidden />}
      title={title}
      description={description}
    />
  );
}

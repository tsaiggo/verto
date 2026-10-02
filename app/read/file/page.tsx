import { Suspense } from "react";
import ImportedFileReader, {
  ImportedFileReaderFallback,
} from "@/components/documents/ImportedFileReader";
export const metadata = { title: "Read document" };
export default function ImportedFileReadPage() {
  return (
    <Suspense fallback={<ImportedFileReaderFallback />}>
      <ImportedFileReader />
    </Suspense>
  );
}

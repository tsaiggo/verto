import { Suspense } from "react";
import BrowserArticleReader, {
  BrowserArticleReaderFallback,
} from "@/components/articles/BrowserArticleReader";

export const metadata = { title: "Read article" };

/** A static route; the browser document identity is resolved after hydration. */
export default function BrowserArticleReadPage() {
  return (
    <Suspense fallback={<BrowserArticleReaderFallback />}>
      <BrowserArticleReader />
    </Suspense>
  );
}

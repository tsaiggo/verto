import Link from "next/link";
import { ArrowLeft, BookOpen, FileQuestion } from "lucide-react";
import { SystemState, systemStateStyles as styles } from "@/components/layout/SystemState";

export default function NotFound() {
  return (
    <SystemState
      eyebrow="404 · Local workspace"
      icon={FileQuestion}
      title="Page not found"
      description="This route does not point to a readable page. The file may have moved, been renamed, or fallen outside the current source."
      actions={
        <>
          <Link href="/library" className={styles.primary}>
            <BookOpen aria-hidden />
            Browse Library
          </Link>
          <Link href="/" className={styles.secondary}>
            <ArrowLeft aria-hidden />
            Back to Home
          </Link>
        </>
      }
    />
  );
}

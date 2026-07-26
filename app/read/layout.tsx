import styles from "@/components/reader/ReaderWorkspace.module.css";

/** Shared bounded viewport for every Reader route. */
export default function ReadLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`docs-layout read-layout ${styles.layout}`} data-reader-layout>
      {children}
    </div>
  );
}

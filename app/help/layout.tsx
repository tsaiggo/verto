import styles from "@/components/reader/ReaderWorkspace.module.css";

/** Help shares the Reader viewport; the global application rail owns its tree. */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`docs-layout ${styles.layout}`} data-help-layout>
      {children}
    </div>
  );
}

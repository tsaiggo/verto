import Link from "next/link";

export interface SurfaceTabItem {
  href: string;
  label: string;
  current?: boolean;
}

/**
 * Route-backed context tabs for the fixed band below an entity header.
 * Links keep the navigation honest while sharing the same visual contract as
 * Library's in-place filters and the reader's open-document tabs.
 */
export default function SurfaceTabs({ label, items }: { label: string; items: SurfaceTabItem[] }) {
  return (
    <nav className="surface-tabs" aria-label={label} data-page-tabs>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`surface-tab${item.current ? " is-active" : ""}`}
          aria-current={item.current ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

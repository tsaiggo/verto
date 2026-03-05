import type { NavigationConfig, NavGroup } from "@/lib/types";
import navigationData from "@/content/navigation.json";

/**
 * Returns the full typed navigation configuration.
 */
export function getNavigation(): NavigationConfig {
  return navigationData as NavigationConfig;
}

/**
 * Returns all doc href values as slug arrays for `generateStaticParams`.
 * e.g. "/docs/getting-started/introduction" → ["getting-started", "introduction"]
 */
export function getDocSlugs(): string[][] {
  const { docs } = getNavigation();
  const slugs: string[][] = [];

  for (const group of docs) {
    for (const item of group.items) {
      collectSlugs(item.href, slugs);
      if (item.items) {
        for (const child of item.items) {
          collectSlugs(child.href, slugs);
        }
      }
    }
  }

  return slugs;
}

function collectSlugs(href: string, out: string[][]): void {
  // Strip leading "/docs/" and split into segments
  const stripped = href.replace(/^\/docs\//, "");
  if (stripped) {
    out.push(stripped.split("/"));
  }
}

/**
 * Returns the NavGroup that contains the given pathname, or undefined.
 */
export function getActiveGroup(pathname: string): NavGroup | undefined {
  const { docs } = getNavigation();

  return docs.find((group) =>
    group.items.some(
      (item) =>
        item.href === pathname ||
        item.items?.some((child) => child.href === pathname),
    ),
  );
}

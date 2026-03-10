import type { NavigationConfig } from "@/lib/types";
import navigationData from "@/content/navigation.json";

/**
 * Returns the full typed navigation configuration.
 */
export function getNavigation(): NavigationConfig {
  return navigationData as NavigationConfig;
}

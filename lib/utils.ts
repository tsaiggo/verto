import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — composes Tailwind class strings safely.
 *
 * Combines `clsx` (conditional class merging) with `tailwind-merge`
 * (de-duplicates conflicting Tailwind utilities, e.g. `p-2 p-4` → `p-4`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

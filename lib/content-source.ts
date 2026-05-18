// Re-export bridge for legacy imports.
//
// The implementation now lives in `lib/content-source/`. This file stays
// so that `import { getContentTree } from "@/lib/content-source"` continues
// to work without churn across the codebase.

export * from "./content-source/index";

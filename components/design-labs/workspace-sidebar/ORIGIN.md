# Origin: workspace-sidebar

- Source: `/Users/tsaiggo/programming/design-labs/src/experiments/workspace-sidebar/`
- Date copied: 2026-09-22
- Files: Preview.tsx, WorkspaceSidebar.tsx, styles.css (all copied verbatim then transformed)
- Preview only, do not wire to prod data

## Transformations

- Added `"use client"` directive to Preview.tsx and WorkspaceSidebar.tsx
- Removed `import "./styles.css"` from Preview.tsx (Next.js app router forbids global CSS import in components)
- Styles moved to `public/design-labs/workspace-sidebar/styles.css` and linked via <link> in app/labs
- DM Sans handling: removed `@import url(https://fonts.googleapis.com/css2?family=DM+Sans...)` line and changed font-family stack from `"DM Sans"` to `Inter, -apple-system, ...` to satisfy repo ban on DM Sans CDN. Documented here; no webfont CDN added.

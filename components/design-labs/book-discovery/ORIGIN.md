# Origin: book-discovery

- Source: `/Users/tsaiggo/programming/design-labs/src/experiments/book-discovery/`
- Date copied: 2026-09-22
- Files: Preview.tsx, BookHero.tsx, BookSearch.tsx, BookCard.tsx, BookShelf.tsx, CategoryTabs.tsx, data.ts, styles.css
- Assets: book cover images copied to `public/book-discovery/` (from design-labs/public/book-discovery/)
- Preview only, do not wire to prod data

## Transformations

- Added `"use client"` directive to all .tsx files using hooks/state
- Removed `import "./styles.css"` from Preview.tsx
- Styles moved to `public/design-labs/book-discovery/styles.css` and linked via <link> in app/labs
- Covers use same `/book-discovery/*.jpg` paths as source; images are preview assets only.

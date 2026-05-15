# Illustrations

Hand-drawn, line-art SVG illustrations used as light visual accents across
Verto. The style is intentionally inspired by the open-source
[Open Peeps](https://www.openpeeps.com/) collection by Pablo Stanley
(CC0): rough strokes, single-color outlines, friendly Q-version proportions.

These illustrations are **original drawings** authored for this project, so
there are no third-party licensing concerns. Strokes use `currentColor` so
the same SVG works in both light and dark mode — set the parent's
`color` (e.g. `style={{ color: "var(--text)" }}`) to recolor.

## Components

- `ReadingPerson` — a person reading a book. Used on the home page header.
- `LostPerson` — a person scratching their head, looking for something. Used on the 404 page.
- `EmptyBox` — an empty open box with a couple of stars. Used on the empty-directory state.

## Adding a new illustration

1. Create a new `*.tsx` file in this folder exporting a default React component.
2. Use `viewBox` and accept `className` / `style` / `width` / `height` props as needed.
3. Draw with `stroke="currentColor"` and `fill="none"` (or `fill="currentColor"` with low opacity for soft fills) so the drawing inherits the surrounding text color and works in dark mode out of the box.
4. Keep `strokeLinecap="round"` and `strokeLinejoin="round"` for the hand-drawn feel.

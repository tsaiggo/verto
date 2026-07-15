# Verto reading experience — design QA

## Final result

**Passed** — the reader, shared shell, responsive states, dark theme, reading controls, mobile navigation, and wide-screen reading companion match the intended flat, editorial workspace direction without visible clipping or horizontal overflow.

## Source of truth

- Reference URL: https://developers.openai.com/blog/mastering-codex-remote-for-engineering
- User-provided reference: `C:\Users\ttsai\AppData\Local\Temp\codex-clipboard-a4ad88dc-fc4e-4225-91d3-4af98a53095a.png`
- Same-viewport reference capture: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\10-openai-reference-1440x900.png`
- Reference viewport/state: 1440 × 900, light theme, article top, assistant closed

The reference establishes a flat white reading canvas, quiet side navigation, a centered editorial masthead, a wide readable article column, hairline pane separators, and an optional right-side assistant.

## Implementation evidence

- Final desktop reader: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\25-verto-final-desktop-1440x900.png`
- Final 1024px reader: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\22-verto-final-1024x800.png`
- Final mobile reader: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\27-verto-final-mobile-390x844-clean.png`
- Final dark reader: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\06-verto-reader-after-dark-desktop.png`
- Reading settings: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\09-reading-settings-polished.png`
- Reading companion open: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\26-verto-final-companion-1440x900-retry.png`
- Mobile navigation open: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\28-verto-final-mobile-navigation.png`
- Shared home surface: `C:\Users\ttsai\.codex\visualizations\2026\07\15\verto-reading-polish\16-home-after-global-polish-retry.png`

## Comparison

The reference and implementation were reviewed together at 1440 × 900 in one comparison input.

| Area | Reference | Final implementation | Result |
| --- | --- | --- | --- |
| Canvas | Flat white panes with fine separators | Flat white work surface, warm neutral rail, no inset card | Match |
| Reading hierarchy | Centered metadata, title, dek, author | Centered editorial masthead inside the scroll region | Match |
| Main measure | Wide article with balanced side rails | 814px article at the captured wide setting; user width controls remain functional | Match |
| Navigation | Quiet, compact left rail | 244px compact workspace rail with 14px rows and restrained active state | Match in product context |
| Outline | Flat right outline | 248px flat TOC with hairline and active marker | Match |
| Assistant | Optional right-side agent | Full-height dock on wide screens; modal slide-over below 1400px | Match in product context |
| Mobile | Content-first, minimal chrome | 390px layout with 40px actions, readable line length, and polished drawer | Passed |
| Dark theme | Not shown in source | Warm near-black panes with preserved contrast and hierarchy | Passed |

## Findings and iteration history

1. The original desktop reader lost roughly 300px to four fixed bands and placed the title outside the scroll region. The masthead now scrolls with the document while the compact 40px document tabs stay fixed.
2. The original shell used a 10px inset, 17px radius, card border, and shadow around the entire work surface. The final shell is pane-based with a single hairline divider.
3. The original reader hard-coded a 760px maximum and ignored Narrow/Normal/Wide/Full settings. The final article uses `--reading-max-w`; manual interaction measured 640px for Narrow and a wider constrained measure for Full.
4. The original TOC was a numbered card. It is now a flat outline with a subtle vertical guide and active indicator.
5. At 1024px, legacy icon-only rules compressed action text into 32px boxes. The final row uses intrinsic button widths, wraps safely, and has no horizontal overflow.
6. The wide reading companion initially overlaid article text. The final layout reserves its live persisted width, removes the TOC while open, and measured zero article/panel overlap.
7. The mobile navigation initially inherited incomplete desktop-only styles. It now has a compact workspace row, consistent 40px navigation targets, controlled scrolling, and closes after navigation.
8. Nested directory and runtime-loading branches initially violated the reader's fixed `tabs + scroll` grid contract. Their DOM is now normalized, while no-tab runtime states use an explicit single-row layout.
9. The narrow reading companion looked modal but was not keyboard-modal. It now exposes dialog semantics, takes initial focus, traps Tab/Shift+Tab, closes on Escape, and restores focus to the opener; the wide dock remains non-modal.
10. The desktop shell's titlebar margin could collapse through `body`, creating a second document scrollbar. A desktop formatting context now contains that offset; the document and viewport dimensions match at 1024px and 1440px.

## Validation

- In-app browser: 1440 × 900 light, 1440 × 900 dark, 1024 × 800, and 390 × 844
- Interactions: theme selection, reading width changes, reading settings popover, companion open/dock, narrow-dialog focus loop and Escape restoration, mobile drawer open and route-close
- Horizontal/document overflow: none at 1024px, 1440px, and 390px
- Companion overlap: 0px at 1440px with a 440px panel
- Runtime no-tab state: scroll viewport and companion both begin directly below the 100px desktop chrome boundary
- `npm run typecheck`: passed
- `npm run lint`: passed with seven pre-existing complexity/line-count warnings and no errors
- `npm test`: 90 files and 727 tests passed
- `npm run build`: passed; 180 static pages generated
- Playwright CLI suite: not run yet; explicit permission was requested because the selected Product Design browser workflow requires it

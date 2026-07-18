# Verto Codex Desktop clone - design QA

## Scope

This report covers the Codex Desktop shell and the Verto surfaces placed inside
it: borderless client frame, opaque white project rail, full-width task canvas,
floating Environment card, Home timeline and composer, Reader, Reading
companion, Agent, responsive navigation, and dark mode.

## Source of truth

- User-provided final Codex Desktop reference:
  `C:\Users\ttsai\AppData\Local\Temp\codex-clipboard-4860287a-eed8-4a45-8f35-b2fd16191559.png`
- User-provided strip explicitly marked for removal:
  `C:\Users\ttsai\AppData\Local\Temp\codex-clipboard-03fadab4-57c0-473b-ad40-967a819aac0f.png`
- Source image: 2847 x 1565.
- User-provided material correction: the warm color visible in the reference
  left rail comes from Windows transparency revealing the wallpaper. In the
  intended light theme, the product rail is opaque white. This explicit
  correction supersedes sampled pixels from that region.
- Canonical comparison state: the source is proportionally normalized to
  2048 x 1126. The implementation uses a 2048 x 1161 browser viewport with the
  client shell beginning directly at y=0. Focused comparisons use the same
  2047px captured width and the first 120px of each frame.
- State: Home, light theme, bundled demo source, Environment open.

The earlier fixed 1024px task pane plus 728px file inspector is superseded by
this final reference and is not an acceptance source for the shell.

## Canonical geometry gate

| Region | Reference | Measured implementation | Result |
| --- | ---: | ---: | --- |
| Opaque project rail | 296-297px | 295.93px | Passed |
| Full workspace canvas | about 1751px | 1752.07px | Passed |
| Workspace header | 50px | 49.97px | Passed |
| Floating Environment card | about 324 x 585px | 325 x 592.88px | Passed |
| Environment inset | top 65px, right 16px | top 65.94px, right 15.97px | Passed |
| Thread and composer axis | 800px | 800px | Passed |
| Progress pill | about 309 x 40px | 309 x 39.93px | Passed |
| Composer | 800 x 108px | 800 x 107.93px | Passed |
| Composer bottom gap | 16px | 15.97px | Passed |
| Client-shell top offset | 0px | 0px | Passed |
| Window horizontal overflow | 0px | 0px | Passed |

## Opaque material gate

Browser-computed styles were measured at 2048 x 1161 in light mode after the
final correction.

| Surface | Expected | Measured | Result |
| --- | --- | --- | --- |
| Left project rail | opaque white | `rgb(255, 255, 255)`, no image, opacity 1, no backdrop filter | Passed |
| Task header | opaque white | `rgb(255, 255, 255)`, no image, opacity 1, no backdrop filter | Passed |
| Workspace canvas | opaque white | `rgb(255, 255, 255)`, no image, opacity 1, no backdrop filter | Passed |
| Workspace setup card | opaque white | `rgb(255, 255, 255)`, no image, opacity 1, no backdrop filter | Passed |
| Floating Environment card | opaque white | `rgb(255, 255, 255)`, no image, opacity 1, no backdrop filter | Passed |
| Active rail row | neutral gray | `rgb(237, 237, 237)`, no warm tint | Passed |

At 390 x 844, the mobile task header and navigation panel also measured opaque
white with zero horizontal overflow. The dark theme retained its independent
dark rail, header, and workspace tokens.

## Same-state visual evidence

- Full-view source and implementation in one comparison input, source above
  and implementation below:
  `artifacts/design-qa/codex-desktop-white-shell-comparison.png`
- Focused rail and task-header comparison in one input:
  `artifacts/design-qa/codex-desktop-white-shell-focus-comparison.png`
- Canonical implementation, full window:
  `artifacts/design-qa/codex-desktop-white-shell-final.jpg`
- Canonical implementation, shell-content crop:
  `artifacts/design-qa/codex-desktop-white-shell-content-2048x1126.png`
- Normalized source:
  `artifacts/design-qa/codex-desktop-strict-source-2048x1126.png`
- Borderless top-frame comparison, source above and implementation below:
  `artifacts/design-qa/codex-borderless-shell-comparison.png`
- Reported menu bar and corrected implementation in one comparison:
  `artifacts/design-qa/codex-menu-bar-removal-comparison.png`
- Canonical borderless implementation:
  `artifacts/design-qa/codex-borderless-shell-full.png`

The combined comparison was inspected at the same effective viewport. Geometry
continues to match the supplied desktop anatomy. The light header and rail now
intentionally differ from the warm screenshot pixels because the user's
material correction establishes opaque white as the actual design truth.

## Findings and comparison history

- Earlier P1: the reference's wallpaper tint was misread as a product gradient,
  producing a warm Mica-like window bar and rail.
  - Fix: replaced the light window and rail gradients with solid white surface
    tokens, removed warm shadow and hover channels, neutralized the active-row
    gray, and made the setup and Environment cards opaque white.
  - Post-fix evidence: the full-view and focused comparison images above, plus
    the computed material table, show the corrected white shell with the same
    geometry.
- Earlier P0: removed the fixed 728px workspace inspector that incorrectly
  divided the shell into three permanent columns.
- Earlier P0: expanded Home to one continuous workspace and centered the thread
  and composer on its full width.
- Earlier P1: replaced the static dashboard hierarchy with a compact task
  transcript; secondary workspace cards now sit behind a collapsed overview
  row.
- Earlier P1: implemented the Home-local Environment card with real source,
  document, browser-preview, library, and Agent context instead of fabricated
  Git state.
- Earlier P2: verified the Environment toggle, dark theme, 1759px hide
  breakpoint, 390px mobile composer, Reader, and Agent route isolation.
- Latest P1: a simulated Windows menu bar consumed the top 38px even though the
  selected borderless Codex frame begins with the project rail and task canvas.
  - Fix: removed the `TitleBar` mount and hydration script, zeroed all chrome
    offsets, deleted its CSS, and restored native OS decorations in packaged
    desktop builds so window management remains usable outside the web client.

No actionable P0, P1, or P2 visual mismatch remains after the material pass.

## Required fidelity surfaces

- Fonts and typography: the Segoe UI Variable Text stack, weights, line heights,
  truncation, and 800px transcript wrapping remain unchanged from the passed
  geometry baseline.
- Spacing and layout rhythm: 0px client-shell top offset, 296px rail at the
  reference viewport, 50px task header, 800px transcript/composer axis, panel inset,
  radii, and vertical rhythm remain within the measured tolerances above.
- Colors and visual tokens: all light shell surfaces are opaque neutral white;
  selected and hover states use neutral gray/black channels. Dark mode retains
  its separate token set.
- Image quality and asset fidelity: this product shell contains no reference
  raster artwork that requires recreation. Icons continue to come from the
  existing icon library, with no placeholder, CSS-art, emoji, or handcrafted
  SVG replacement.
- Copy and content: Verto labels and live library data intentionally replace
  Codex-specific repository, Git, and subagent state.

Focused comparison was required because the corrected rail and task-header
materials are too small to judge reliably in the full-window view.

## Route and interaction QA

- The simulated File, Edit, View, and Help strip is absent. Its product
  destinations remain available through the rail and task-header menus.
- The rail uses real Verto routes, content nodes, source status, Settings, and
  Help rather than copied Codex user data.
- Home search submits to the live `/search?q=...` route.
- The header control opens and closes the Environment card.
- The card uses the live source summary and real document links. It does not
  claim a branch, commit, working-tree state, or running subagents that Verto
  cannot observe.
- Environment is Home-local. Reader and Agent retain their own route-specific
  layouts without a global inspector or horizontal overflow.
- At 1759px the floating card hides before it can overlap the 800px thread.
- At 390 x 844 the rail collapses, the page has no horizontal overflow, and the
  mobile navigation panel is opaque white.
- Home, Reader, and Agent were remeasured at desktop width with zero simulated
  menu nodes and shell/rail top at 0px. The 390 x 844 mobile shell also starts
  at 0px with 390px client and scroll widths.
- Dark mode was toggled through the visible Appearance control; the dark rail
  and workspace both start at 0px with no simulated menu present.
- Light and dark themes were visually and computationally inspected.
- Browser console inspection found no runtime errors.

## Route-surface unification follow-up (2026-07-16)

The Codex shell is now the shared frame for every primary Verto route, rather
than a close Home shell surrounding unrelated legacy page layouts. Search,
Inbox, Sources, Settings, Collections, Bookmarks, Tags, Recent, Studio,
Editor, Help, onboarding, Reader indexes, and Agent now use the same content
widths, typography, toolbar rhythm, tabs, empty states, status treatments, and
responsive rules.

- The final Home state was compared with the supplied Codex reference at the
  exact 2048 x 1161 implementation viewport. The 296px rail, 50px header,
  800px transcript/composer axis, rounded sheet junction, and floating
  Environment placement remained within the already accepted geometry gate.
- Final route evidence:
  - `artifacts/route-qa/final-home-2048x1161.png`
  - `artifacts/route-qa/final-search-light-1200x800.png`
  - `artifacts/route-qa/final-editor-mobile-390x844.png`
  - `artifacts/route-qa/final-settings-mobile-390x844.png`
  - `artifacts/route-qa/final-search-dark-1200x800.png`
- Mobile routes were checked at 390 x 844 for Search, Inbox, Sources,
  Settings, Studio, Agent, Editor, onboarding, and Library. Each reported a
  390px document and main scroll width with no horizontal overflow.
- Search-to-Agent handoff preserves the query as an editable composer draft;
  it does not silently submit. Agent suggested prompts and deterministic send
  states were exercised.
- RSS removal now previews the number of cached articles that will be removed
  and requires confirmation. Source connect/disconnect state, source override
  reset, collection CRUD, Studio edit/delete/copy, Editor save/download and
  new-document discard protection, onboarding readiness, reading preference
  persistence/reset, voice input support, and assistant credential failure
  handling are implemented rather than decorative affordances.
- Tabs have stable tab/tab-panel associations and inactive panels remain in
  the accessibility tree contract without rendering hydration-sensitive MDX.
  A fresh Editor load produced only the React development and HMR information
  messages, with no hydration warning or runtime error.
- Dark success and danger tokens meet normal-text contrast on the dark canvas
  (approximately 6.98:1 and 5.07:1 respectively).

## Automated validation

- TypeScript typecheck: passed.
- Vitest: 143 files, 961/961 tests passed.
- ESLint: 0 errors; 15 non-blocking size/complexity warnings.
- Production build: passed.
- Prettier and `git diff --check`: passed.
- Static desktop-shell contract: passed for absent simulated menu, native
  Windows/macOS decorations, and removed custom window permissions.
- Desktop geometry contract: 42/42 Playwright checks passed across the strict
  2048px reference viewport and responsive desktop widths.
- Focused route and interaction regression: 70 passed, 2 intentionally
  skipped, 0 failed.
- Complete non-visual Playwright regression: 150 passed, 4 intentionally
  skipped, 0 failed.
- Visual regression: 5/5 scenario groups passed against 49 approved
  screenshots covering 15 primary routes in desktop light, desktop dark, and
  mobile light states, plus the Reader companion, reading settings, and mobile
  navigation states.

The screenshot set was re-recorded from the strict desktop baseline and then
rerun without updates. The clean no-update run passed in full.

## Honest scope boundary

The Environment card reflects Verto's readable content source and product
routes. It intentionally does not pretend to expose repository Git metadata,
Codex subagents, or arbitrary hidden folders, because Verto has no runtime API
for those states.

## Workspace arc correction

The supplied focused crop established the top-left workspace junction as one
continuous rounded sheet rather than four independently divided chrome
regions. The earlier implementation stacked the window-bar bottom rule, the
rail's double inset shadow, the workspace edge, and the task-header bottom
border. Their intersection created the reported cross-shaped, over-segmented
result.

- Source truth:
  `C:/Users/ttsai/AppData/Local/Temp/codex-clipboard-0620e61f-7de1-45e8-8944-797fe89c60f7.png`
- Reported pre-fix crop:
  `C:/Users/ttsai/AppData/Local/Temp/codex-clipboard-dc0bf599-d8a5-4230-8c99-ed080459bda4.png`
- Same-scale source and implementation comparison:
  `artifacts/design-qa/codex-workspace-arc-comparison.png`
- Canonical implementation crop:
  `artifacts/design-qa/codex-workspace-arc-final.png`
- Canonical full-window evidence:
  `artifacts/design-qa/codex-workspace-arc-full.png`

At 2048 x 1161, the implementation now measures a 15.97px top-left workspace
radius. No simulated menu bar is mounted; the rail and task header each report
no border-bottom and no box shadow. The workspace alone owns the junction with one 5% one-pixel edge
and one 2.4% soft elevation shadow. This preserves the user's corrected opaque
white surfaces while making the arc legible without rebuilding the hard grid.

Post-fix visual inspection of the combined image passed. No actionable P0, P1,
or P2 mismatch remains at this junction.

final result: passed

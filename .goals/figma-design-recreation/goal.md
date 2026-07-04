# Goal: High-fidelity Figma design recreation

## User Request

Use the `goal` skill. We need to create high-fidelity, pixel-level reproductions in Figma of our design mockups as groundwork for later code. The mockups are in `C:\Programming\verto\docs\design`. Process them one by one, build each screen, compare/verify, and continue until the work is complete.

The user is temporarily unavailable, so proceed autonomously with the recommended assumptions:
- Target Figma file: `https://www.figma.com/design/augyZFa4Qz26V0MkzZXz5f/verto`
- Target file key: `augyZFa4Qz26V0MkzZXz5f`
- The existing Figma file is currently empty and should be used as the destination.

## Refined Goal

Create a high-fidelity Figma reproduction of every mockup in `docs\design`, using the existing empty `verto` Figma file as the destination. Work one source image at a time in the documented order, beginning with the design system/app shell board, then the product screens, and ending with the product overview. The resulting Figma file should be organized, inspectable, and useful as a foundation for later code implementation, with source references, reconstructed frames, reusable visual foundations, and per-board verification notes.

This is a Figma/design task, not a code implementation task. Do not modify application source code unless it is strictly required for verification and explicitly documented.

## Acceptance Criteria

- [ ] The target Figma file contains a clearly named page for this work, with eight top-level 3840 x 2160 design frames corresponding to the files in `docs\design`.
- [ ] Frames are created in this order: `01_design-system_and_app-shell.png`, `02_reader_and_annotation-system.png`, `03_editor_and_mdx-authoring.png`, `04_agent-workspace_and_write-approval.png`, `05_library_search_and_knowledge-studio.png`, `06_sources_integrations_and_git-workflow.png`, `07_onboarding_states_and_responsive.png`, then `00_product-overview_with-knowledge-activity.png`.
- [ ] Each Figma frame is named with its numeric prefix and descriptive title, and each includes the original source PNG as a locked or clearly separated reference layer so future reviewers can compare it directly.
- [ ] Each frame includes a high-fidelity reconstructed design layer/group aligned to the 3840 x 2160 canvas. The reconstruction must visually match the source mockup closely enough for pixel-level design review, including layout, spacing, colors, typography scale, major UI elements, icons, cards, panels, and dark/light surfaces visible in the source image.
- [ ] Board `01_design-system_and_app-shell.png` establishes reusable visual foundations in Figma: color styles or variables where practical, typography styles where practical, and reusable component/group patterns for shell navigation, cards, buttons, callouts, code blocks, pills/badges, panes, and common controls used by later boards.
- [ ] Later boards reuse or consistently mirror those foundations instead of inventing unrelated styles.
- [ ] A verification record is written under `.goals\figma-design-recreation\` documenting every source image, the corresponding Figma frame name/node id when available, whether it was completed, and any fidelity gaps that remain.
- [ ] Inspector can verify completion by reading the Figma file metadata/screenshots and comparing it against the source PNG inventory.
- [ ] Existing uncommitted source changes present before this goal (`app\globals.css`, `components\home\HomeCards.tsx`) are not overwritten, reverted, staged, or committed as part of this goal unless directly required and explicitly justified.

## Scope Boundaries

**In scope:**
- Use Figma MCP tools to create or update the existing `verto` Figma design file.
- Upload or otherwise place all eight PNG source mockups as references in Figma.
- Create organized 3840 x 2160 frames for each mockup.
- Reconstruct the visual design in Figma with layered objects/components where practical.
- Build sequentially, verifying each board before moving to the next.
- Maintain `.goals\figma-design-recreation\` process artifacts, including verification notes and Inspector feedback.

**Out of scope:**
- Implementing or changing application code.
- Creating a PR or pushing to remote.
- Merging anything into `main`.
- Building interactive Figma prototypes or animations unless needed for static visual fidelity.
- Replacing the product architecture, content model, or tech stack.
- Deleting or reverting existing local user changes.

## Applicable Project Conventions

**Quality gate command:**
- For this Figma-only task, there may be no meaningful application quality gate if no app source files are changed.
- If any application code is changed, run the full project gate before finishing:
  `npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run build`
- Always inspect git state before committing:
  `git --no-pager status --short`

**Commit convention:**
- Project branch prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`.
- Goal skill iteration commits must still use role markers:
  - Builder: `feat(figma): [B] recreate design boards`
  - Inspector: `chore(figma): [I] inspect design boards`
- Include the required `Assisted-by:` trailer for the active goal subagent.
- Do not commit directly to `main`. Current branch at goal creation: `feat/redesign-ui-from-mockups`.

**Guidelines:**
- `AGENTS.md`
- `.github\copilot-instructions.md`
- `docs\design\README.md`
- `TECH_STACK.md`

**Rules:**
- Never commit or push directly to `main`.
- All production changes should go through a Pull Request; do not merge yourself.
- Before making changes, check `git branch --show-current`.
- Preserve unrelated user changes in the worktree.
- Prefer precise, surgical changes and avoid unrelated code modifications.
- For Figma MCP write actions, load the `figma-use` skill before calling `figma-use_figma`.

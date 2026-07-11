// Static fixture data shared across the `/final` reference-scaffold surfaces
// (see `FinalPackScreen.tsx`). These are representative sample rows used only by
// the reference boards, not by real product routes.

/** Knowledge Studio card rows: [title, kind, description, meta]. */
export const cards: string[][] = [
  ["Agent-native Workflows", "Workflow", "Roles, tools, context and guardrails.", "18 links"],
  ["Design Principles", "Principles", "Core AI product principles.", "15 links"],
  ["Product Strategy 2025", "Strategy", "Goals, positioning and bets.", "9 links"],
  ["Evaluation Framework", "Framework", "Reliability and relevance checks.", "7 links"],
  ["Competitive Landscape", "Research", "Adjacent product analysis.", "15 links"],
  ["User Research Synthesis", "Research", "Interview insights and synthesis.", "11 links"],
];

/** Sources table rows: [name, path, type, status, count]. */
export const sourceRows: string[][] = [
  ["Local Library", "/Users/alex/verto", "Local", "Synced", "1,248"],
  ["Verto Local Library", "/content", "Git", "Synced", "632"],
  ["Personal Notes", "OneDrive/Notes", "Cloud", "Syncing", "1,102"],
  ["Reading List", "12 RSS feeds", "Web", "Synced", "256"],
  ["Research Papers", "/Users/alex/papers", "Local", "Pending", "98"],
  ["Work Docs", "gitlab.com/acme/docs", "Git", "Error", "--"],
];

/** Git changed-file rows: [file, badge, delta]. */
export const gitFiles: string[][] = [
  ["docs/agent-workflow.mdx", "M", "+24 -6"],
  ["components/Callout.tsx", "M", "+12 -2"],
  ["assets/diagram.svg", "A", "+18"],
  ["README.md", "M", "+8 -1"],
];

/** Reference-shell nav rows: [label, icon] or [label, icon, badge]. */
export const referenceNav: string[][] = [
  ["Home", "⌂"],
  ["Inbox", "▣", "6"],
  ["Library", "▤"],
  ["Collections", "□"],
  ["Tags", "◇"],
  ["Bookmarks", "♡"],
  ["Graph", "◌"],
  ["Agent", "✦"],
  ["Knowledge Studio", "⌘"],
  ["Activity", "◉"],
];

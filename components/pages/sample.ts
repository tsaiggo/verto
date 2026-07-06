/**
 * Representative sample data for the redesigned navigation pages. Real content
 * is used whenever the active content source provides it; when a workspace is
 * empty (e.g. a fresh checkout) these samples keep the UI matching the design
 * mockups instead of showing bare empty states everywhere.
 */

export interface SampleDoc {
  title: string;
  file: string;
  href: string;
  source: string;
  tags: string[];
  updated: string;
  excerpt: string;
}

export const SAMPLE_DOCS: SampleDoc[] = [
  {
    title: "Agent-native Workflows",
    file: "agent-native-workflows.mdx",
    href: "/read",
    source: "Writing with MDX Components",
    tags: ["agent", "workflows", "principles"],
    updated: "10m ago",
    excerpt: "A new paradigm where AI agents autonomously plan, execute, and verify.",
  },
  {
    title: "Key Features",
    file: "key-features.md",
    href: "/read",
    source: "Product Design",
    tags: ["features", "overview"],
    updated: "1h ago",
    excerpt: "Product overview and capabilities.",
  },
  {
    title: "AI in Product Design",
    file: "ai-in-product-design.md",
    href: "/read",
    source: "AI & Agents",
    tags: ["ai", "design", "research"],
    updated: "Yesterday",
    excerpt: "Research notes and references.",
  },
  {
    title: "Multi-source RAG Notes",
    file: "multi-source-rag-notes.md",
    href: "/read",
    source: "Engineering Notes",
    tags: ["rag", "research", "engineering"],
    updated: "Yesterday",
    excerpt: "Evaluation and benchmarking.",
  },
  {
    title: "Designing AI Products",
    file: "designing-ai-products.md",
    href: "/read",
    source: "Research Library",
    tags: ["ai", "design", "principles"],
    updated: "2d ago",
    excerpt: "Principles and patterns.",
  },
  {
    title: "Product Roadmap Q2 2025",
    file: "product-roadmap-q2-2025.md",
    href: "/read",
    source: "Product Design",
    tags: ["roadmap", "planning"],
    updated: "2d ago",
    excerpt: "Goals, milestones, and experiments.",
  },
  {
    title: "User Research Synthesis",
    file: "user-research-synthesis.md",
    href: "/read",
    source: "Research Library",
    tags: ["research", "user", "insights"],
    updated: "3d ago",
    excerpt: "Insights from interviews and surveys.",
  },
  {
    title: "Prompt Patterns Catalog",
    file: "prompt-patterns-catalog.md",
    href: "/read",
    source: "AI & Agents",
    tags: ["prompts", "templates", "agent"],
    updated: "3d ago",
    excerpt: "Reusable prompts and templates.",
  },
  {
    title: "Design System Tokens",
    file: "design-system-tokens.md",
    href: "/read",
    source: "Engineering Notes",
    tags: ["design-system", "tokens", "ui"],
    updated: "4d ago",
    excerpt: "Typography, color, spacing, and more.",
  },
  {
    title: "Onboarding Flow Redesign",
    file: "onboarding-flow-redesign.md",
    href: "/read",
    source: "Product Design",
    tags: ["ux", "onboarding", "copy"],
    updated: "5d ago",
    excerpt: "Spec and copy for new user experience.",
  },
];

export interface SampleCollection {
  name: string;
  count: number;
  updated: string;
  tint: string;
  icon: "users" | "sparkles" | "layout" | "notebook" | "braces" | "bookmark";
}

export const SAMPLE_COLLECTIONS: SampleCollection[] = [
  {
    name: "Product Planning",
    count: 12,
    updated: "Updated 2h ago",
    tint: "#6366f1",
    icon: "users",
  },
  { name: "AI Research", count: 28, updated: "Updated 1d ago", tint: "#16a34a", icon: "sparkles" },
  {
    name: "Design Inspiration",
    count: 15,
    updated: "Updated 2d ago",
    tint: "#7c3aed",
    icon: "layout",
  },
  { name: "Team Notes", count: 8, updated: "Updated 2w ago", tint: "#db2777", icon: "notebook" },
  { name: "Project Verto", count: 34, updated: "Updated 2h ago", tint: "#2563eb", icon: "braces" },
  { name: "Reading List", count: 23, updated: "Updated 2w ago", tint: "#9333ea", icon: "bookmark" },
];

export interface SampleTag {
  name: string;
  count: number;
  tint?: "ai" | "product";
}

export const SAMPLE_TAGS: SampleTag[] = [
  { name: "ai", count: 128, tint: "ai" },
  { name: "product", count: 96, tint: "product" },
  { name: "research", count: 76 },
  { name: "design", count: 64 },
  { name: "engineering", count: 46 },
  { name: "business", count: 42 },
  { name: "management", count: 38 },
  { name: "marketing", count: 34 },
  { name: "prompting", count: 30, tint: "ai" },
  { name: "python", count: 26 },
  { name: "javascript", count: 24 },
  { name: "leadership", count: 24 },
  { name: "strategy", count: 14 },
  { name: "books", count: 12 },
  { name: "meeting-notes", count: 11 },
  { name: "ideas", count: 10 },
  { name: "finance", count: 9 },
  { name: "career", count: 8 },
  { name: "learning", count: 8 },
  { name: "tools", count: 7 },
  { name: "personal", count: 6 },
];

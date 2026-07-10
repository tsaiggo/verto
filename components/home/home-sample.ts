import type { LibraryGroup, RecentDoc, StarterDoc } from "@/components/home/home-data";

/**
 * Home dashboard fallback data. Real reading state, edits, and collections are
 * always preferred; these representative values are surfaced only when the
 * vault is empty (e.g. a fresh checkout) so the dashboard matches the design
 * mockups instead of showing a screen full of empty states.
 */

export const SAMPLE_RECENT_DOCS: RecentDoc[] = [
  {
    href: "/library",
    title: "02 Key Features.mdx",
    description: "Product overview and capabilities.",
    section: "Product Design",
    iso: null,
    relative: "1 min ago",
  },
  {
    href: "/library",
    title: "Knowledge Graph Ideas.md",
    description: "Research notes and references.",
    section: "AI & Agents",
    iso: null,
    relative: "1 hour ago",
  },
  {
    href: "/library",
    title: "Agent Workflow.md",
    description: "A new paradigm for autonomous workflows.",
    section: "Engineering Notes",
    iso: null,
    relative: "3 hours ago",
  },
  {
    href: "/library",
    title: "Product Roadmap Q2.md",
    description: "Goals, milestones, and experiments.",
    section: "Product Design",
    iso: null,
    relative: "Yesterday",
  },
  {
    href: "/library",
    title: "Prompt Patterns Catalog.md",
    description: "Reusable prompts and templates.",
    section: "AI & Agents",
    iso: null,
    relative: "2d ago",
  },
  {
    href: "/library",
    title: "Design System Tokens.md",
    description: "Typography, color, spacing, and more.",
    section: "Engineering Notes",
    iso: null,
    relative: "4d ago",
  },
];

export const SAMPLE_STARTERS: StarterDoc[] = [
  {
    href: "/library",
    title: "01 Introduction.mdx",
    section: "Last read 2 min ago",
  },
  {
    href: "/library",
    title: "Agent Design Patterns.mdx",
    section: "Last read 1 day ago",
  },
  {
    href: "/library",
    title: "Writing with MDX Components.mdx",
    section: "Last read 2 days ago",
  },
];

export const SAMPLE_CONTINUE_PROGRESS = 42;

export const SAMPLE_GROUPS: LibraryGroup[] = [
  { title: "AI & Agents", href: "/collections", total: 24, items: [] },
  { title: "Product Design", href: "/collections", total: 10, items: [] },
  { title: "Writing", href: "/collections", total: 36, items: [] },
  { title: "Research", href: "/collections", total: 14, items: [] },
  { title: "Personal Wiki", href: "/collections", total: 15, items: [] },
];

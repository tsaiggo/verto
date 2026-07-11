import type { Metadata } from "next";
import { notFound } from "next/navigation";
import packageJson from "@/package.json";
import SettingsView from "@/components/settings/SettingsView";
import { getSourceInfo } from "@/lib/source-info";

const SECTIONS = [
  "general",
  "sources",
  "appearance",
  "editor",
  "reading",
  "agent",
  "privacy",
  "shortcuts",
  "about",
] as const;
type Section = (typeof SECTIONS)[number];

const TITLES: Record<Section, string> = {
  general: "General Settings",
  sources: "Library source",
  appearance: "Appearance Settings",
  editor: "Editor Settings",
  reading: "Reading Settings",
  agent: "AI & Agent Settings",
  privacy: "Privacy Settings",
  shortcuts: "Keyboard Shortcuts",
  about: "About Verto",
};

interface Props {
  params: Promise<{ section: string }>;
}

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  if (!SECTIONS.includes(section as Section)) return { title: "Settings" };
  return {
    title: TITLES[section as Section],
    description: `Manage your ${TITLES[section as Section].toLowerCase()}.`,
  };
}

export default async function SettingsSectionPage({ params }: Props) {
  const { section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();
  return (
    <SettingsView
      initialSection={section as Section}
      source={getSourceInfo()}
      version={packageJson.version}
    />
  );
}

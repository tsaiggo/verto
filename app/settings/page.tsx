import type { Metadata } from "next";
import SettingsView from "@/components/settings/SettingsView";
import { getSourceInfo } from "@/lib/source-info";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your workspace, appearance, editor, agent, and privacy preferences.",
};

export default function SettingsPage() {
  return <SettingsView source={getSourceInfo()} />;
}

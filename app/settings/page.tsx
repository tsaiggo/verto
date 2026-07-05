import type { Metadata } from "next";
import SettingsView from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your workspace, appearance, editor, agent, and privacy preferences.",
};

export default function SettingsPage() {
  return <SettingsView />;
}

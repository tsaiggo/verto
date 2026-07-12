import type { Metadata } from "next";
import InboxView from "@/components/inbox/InboxView";

export const metadata: Metadata = {
  title: "Inbox",
  description: "Articles collected from your subscriptions.",
};

// The inbox is persisted in localStorage, so the list is rendered client-side.
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return <InboxView isOnboardingReturn={from === "onboarding"} />;
}

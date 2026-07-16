import { notFound, redirect } from "next/navigation";
import { getFinalPackItem } from "@/components/final/final-pack-data";
import { INTEGRATION_STATE_TO_ID, slugPath } from "@/components/final/final-route-aliases";

interface IntegrationStatePageProps {
  params: Promise<{ state: string[] }>;
}

export function generateStaticParams() {
  return Object.keys(INTEGRATION_STATE_TO_ID)
    .filter((key) => key !== "overview")
    .map((key) => ({ state: key.split("/") }));
}

export async function generateMetadata({ params }: IntegrationStatePageProps) {
  const { state } = await params;
  const route = slugPath(state);
  if (route.startsWith("add/")) return { title: "Sources & Integrations" };
  const item = getFinalPackItem(INTEGRATION_STATE_TO_ID[route]);
  return { title: item?.title ?? "Sources & Integrations" };
}

export default async function IntegrationStatePage({ params }: IntegrationStatePageProps) {
  const { state } = await params;
  const route = slugPath(state);
  const item = getFinalPackItem(INTEGRATION_STATE_TO_ID[route]);
  if (!item) notFound();

  // These aliases originated as review-board routes. Keep old links working,
  // but always land people on the live Sources workbench instead of exposing
  // the static reference-pack mockups as production product states.
  redirect("/integrations#local-files");
}

import { notFound, redirect } from "next/navigation";
import SourceStateScreen, {
  type SourceSystemState,
} from "@/components/integrations/SourceStateScreen";
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
  if (!(route in INTEGRATION_STATE_TO_ID)) return { title: "Sources" };
  return { title: "Sources" };
}

export default async function IntegrationStatePage({ params }: IntegrationStatePageProps) {
  const { state } = await params;
  const route = slugPath(state);
  if (route === "overview") redirect("/integrations");
  if (route.startsWith("add/")) redirect("/integrations#local-files");
  if (route === "source/detail" || route === "source/health") {
    redirect("/integrations#local-files");
  }
  if (
    route === "no-source" ||
    route === "syncing" ||
    route === "sync-failed" ||
    route === "permission-denied"
  ) {
    return <SourceStateScreen state={route as SourceSystemState} />;
  }
  notFound();
}

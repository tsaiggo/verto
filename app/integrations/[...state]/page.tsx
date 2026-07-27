import { notFound, redirect } from "next/navigation";
import SourceStateScreen, {
  type SourceSystemState,
} from "@/components/integrations/SourceStateScreen";

interface IntegrationStatePageProps {
  params: Promise<{ state: string[] }>;
}

const INTEGRATION_STATES = [
  "add/choose",
  "add/connect",
  "add/configure",
  "add/select-content",
  "add/sync",
  "add/complete",
  "source/detail",
  "source/health",
  "no-source",
  "syncing",
  "sync-failed",
  "permission-denied",
] as const;

export function generateStaticParams() {
  return INTEGRATION_STATES.map((state) => ({ state: state.split("/") }));
}

export function generateMetadata() {
  return { title: "Sources" };
}

export default async function IntegrationStatePage({ params }: IntegrationStatePageProps) {
  const { state } = await params;
  const route = state.join("/");
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

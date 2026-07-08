import PageHeader from "@/components/layout/PageHeader";
import { buildGraph } from "@/lib/graph";
import GraphCanvas from "./GraphCanvas";

export const metadata = { title: "Graph" };

export default async function GraphPage() {
  const graph = await buildGraph();

  return (
    <>
      <PageHeader title="Graph" subtitle="Explore connections between your knowledge." />
      <GraphCanvas data={graph} />
    </>
  );
}

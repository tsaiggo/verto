import { loadAgentSources } from "@/lib/agent-sources";

// Static export emits this JSON file for the desktop build as well. It keeps
// document bodies out of every page's shell payload until Agent is opened.
export const dynamic = "force-static";

export async function GET() {
  try {
    return Response.json(await loadAgentSources());
  } catch {
    return Response.json(
      { error: "The connected knowledge source is unavailable." },
      { status: 503 }
    );
  }
}

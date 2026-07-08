import type { NextApiRequest, NextApiResponse } from "next";
import { getFileBySlug, readFileNodeSource } from "@/lib/content-source";

// ---------------------------------------------------------------------------
// GET /api/editor?slug=<slug>
//
// Returns raw MDX source for the editor. This uses the Pages API layer so
// Next's Tauri static export does not try to pre-render it as an App Router
// route, while local/web development can still fetch the same /api/editor URL.
// ---------------------------------------------------------------------------

interface EditorPayload {
  source: string;
  id: string;
  title: string;
  ext: string;
}

type ErrorPayload = { error: string };

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EditorPayload | ErrorPayload>
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const slug = firstQueryValue(req.query.slug);
  if (!slug) {
    res.status(400).json({ error: "slug is required" });
    return;
  }

  const segments = slug.split("/").filter(Boolean);
  if (segments.length === 0) {
    res.status(400).json({ error: "slug is empty" });
    return;
  }

  try {
    const node = await getFileBySlug(segments);
    if (!node) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const source = await readFileNodeSource(node);
    res.status(200).json({
      source,
      id: node.id,
      title: node.title,
      ext: node.ext,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { getFileBySlug, readFileNodeSource } from "@/lib/content-source";

// ---------------------------------------------------------------------------
// GET /api/editor?slug=<slug>
//
// Returns the raw MDX source for the given content-tree slug so the client-
// side EditorClient can display and edit it.  Intended for the dev-server
// only; the Tauri desktop build uses a direct Rust command instead and the
// static-exported web build has no API routes at all (the editor shows an
// honest "requires the dev server or desktop app" notice in that case).
// ---------------------------------------------------------------------------

interface EditorPayload {
  source: string;
  id: string;
  title: string;
  ext: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const segments = slug.split("/").filter(Boolean);
  if (segments.length === 0) {
    return NextResponse.json({ error: "slug is empty" }, { status: 400 });
  }

  try {
    const node = await getFileBySlug(segments);
    if (!node) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const source = await readFileNodeSource(node);
    const payload: EditorPayload = {
      source,
      id: node.id,
      title: node.title,
      ext: node.ext,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

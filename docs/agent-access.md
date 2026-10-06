# Read-only Agent access

Verto exposes one headless Markdown/MDX content service to its built-in Agent
and a local MCP companion. The service returns bounded passages, document
versions, annotations, and links that locate the cited passage in Reader.

## Connect an external client

1. Install Node.js **20.19 or newer**, available to the client as `node`.
2. In the desktop app, open **Settings → AI & Agent → Agent access**.
3. Add a named client. Share saved local Library documents or select individual
   local documents. An entire connected Markdown/MDX folder can be included
   when sharing the Library. Drafts and annotations each require explicit opt-in.
4. Copy the generated MCP JSON into your client's MCP configuration. The token
   is displayed once and supplied using `VERTO_MCP_TOKEN`; Verto stores its hash.
   Clients that use a different configuration format can copy the same command,
   arguments, and environment entry.
5. Ask the client to search shared documents, read relevant blocks and notes,
   and cite the returned source links. **Revoke** removes the client's grant and
   denies subsequent requests even on an already open connection.

The companion is bundled with the desktop app; it does not require this source
checkout or `node_modules`. It reads saved content while Verto is closed.
It has no write tools, HTTP listener, arbitrary filesystem read tool, shell tool,
or access to unsaved editing buffers. Grants remain attached to their original
folder when the app switches libraries. A new grant is needed to share a new
folder. Changes to granted documents become visible on subsequent reads.

Retrieved content is data, and may be sent to the external client's selected
model provider. Grant only content that you intend to share with that client.
Revocation prevents future retrieval; it cannot remove content already received.

## Content coverage

- Managed local `.md` and `.mdx` articles and saved Notes.
- Regular `.md`/`.mdx` files under an explicitly shared native folder. Hidden
  folders/files, hidden frontmatter documents, and symbolic links are excluded.
- Annotations from the originally authorized workspace's
  `.verto/annotations.json`, or `content-v1/annotations.json` when no folder
  is active. When granting annotation access, the native app records the current
  authorized workspace as `annotationRoot`. Only that workspace's annotation
  store is read; stores are never merged. This permits notes for selected
  documents without granting that folder's other document bodies. Without an active folder,
  the desktop app restores and durably saves annotations in the managed store;
  existing unscoped browser-cache annotations migrate on first hydration.
  Folder-specific annotations remain isolated in their vault. Switching
  workspaces does not silently change an existing client's annotation scope.

The built-in Agent also uses the connected sources already available to the
app. Build-provided static sources retain their existing availability limit;
managed local content and the current native-folder index are not capped at 48
documents. External MCP grants currently cover local persisted content, not
cloud source credentials or the static web build's content catalog.

PDF/EPUB text extraction, scanned-document OCR, mail, RSS, generated summaries,
Collection grants, and AI writes are outside this first release. The web app
uses its browser content service, but cannot create external desktop grants.

## MCP capabilities

| Tool | Result |
| --- | --- |
| `list_documents` | Metadata with cursor pagination; up to 40 documents per call |
| `search_documents` | Keyword passages across authorized content, with block offsets and citations |
| `read_document` | Up to six blocks of 4,000 characters, with continuation cursor and version checks |
| `list_annotations` | Quoted text and separate human/AI note turns; requires annotation consent |
| `resolve_citation` | Validates document version, block identity and quoted excerpt |

`verto://documents` is a read-only JSON catalog resource. The
`verto://documents/{docId}` resource template returns the first bounded block
page; URL-encode the document ID. Use tools to continue reading. These MCP URIs
identify resources, and are separate from the Reader navigation links.

Every passage citation includes `docId`, `version`, `blockId`, `excerpt` and
`href`. Reader verifies the version and locates the quoted text inside the
article. Changed versions are reported; ambiguous or missing quotes are not
silently mapped to another paragraph. Returned Reader paths can be opened in
the running desktop app or its corresponding local UI; they are app-relative
paths, not registered OS deep links.

MDX is parsed as content and never executed by retrieval. Search is lexical,
not semantic. Read responses describe their text-only coverage: raw HTML,
evaluated MDX/component output, and media are omitted; expressions may remain
as source text. Long documents are split into bounded blocks; phrases that span
a block boundary may require a shorter query. Results distinguish original
quotes from note turns. Source instructions cannot grant additional access.

## Development and verification

```sh
npm ci
npm run build:mcp
# Prefer the generated Settings configuration. For a fixture-only manual run:
VERTO_MCP_TOKEN='<fixture-token>' node src-tauri/resources/mcp/verto-mcp.mjs \
  --access-file /absolute/path/to/fixture/agent-access-v1.json --client fixture-client
```

Windows clients should set the token through their MCP environment object,
rather than shell interpolation. Do not commit a real generated configuration.

`pretauri:dev` and `prebuild:tauri` build the companion, and the Tauri bundle maps
it to `mcp/verto-mcp.mjs`. Tests use temporary libraries and an actual SDK client
over stdio. No real provider key or private user library is needed.

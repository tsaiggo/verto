// /final add-source wizard boards (Choose -> Connect -> Configure -> Select -> Sync -> Done).
// Consumed only by SourcesSurface in final-surfaces-sources.tsx.
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { Card, Header, Tabs } from "@/components/final/final-primitives";

export function AddSourceChooseBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header
        item={item}
        actions={<button className="final-btn final-btn-primary">Add Source</button>}
      />
      <Tabs
        labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
        active={0}
      />
      <p className="final-lede">
        Pick where Verto should read documents from. You can add more sources later.
      </p>
      <div className="final-card-grid">
        {[
          ["Local Folder", "Read `.mdx` / `.md` from a folder on disk."],
          ["GitHub", "Public or private repo. Uses your GitHub sign-in."],
          ["OneDrive", "Share URL or private OAuth-connected drive."],
          ["Web / RSS", "Subscribe to RSS or article feeds."],
          ["Import Files", "One-off upload of .zip / .epub."],
          ["Notion", "Pages and databases from a Notion workspace."],
        ].map(([name, desc]) => (
          <Card key={name}>
            <h2>{name}</h2>
            <p>{desc}</p>
            <button className="final-btn">Select</button>
          </Card>
        ))}
      </div>
    </>
  );
}

export function AddSourceConnectBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header
        item={item}
        actions={<button className="final-btn final-btn-primary">Add Source</button>}
      />
      <Tabs
        labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
        active={1}
      />
      <div className="final-two">
        <Card title="Connect GitHub">
          <p className="final-lede">
            Verto will read your repositories via GitHub OAuth. We request only <code>repo</code>{" "}
            read and <code>read:user</code>.
          </p>
          <div className="final-stack compact">
            <div className="final-row">
              <span>
                <strong>Read your repositories</strong>
                <small>Public and private, no writes without approval</small>
              </span>
              <span className="final-pill">Required</span>
            </div>
            <div className="final-row">
              <span>
                <strong>Read your profile</strong>
                <small>Handle + avatar only</small>
              </span>
              <span className="final-pill">Required</span>
            </div>
          </div>
          <div className="final-actions right">
            <button className="final-btn">Cancel</button>
            <button className="final-btn final-btn-primary">Continue with GitHub</button>
          </div>
        </Card>
        <Card title="Permissions we won't request">
          <div className="final-stack compact">
            <div>Write access to your repositories</div>
            <div>Access to organizations you haven&apos;t approved</div>
            <div>Anything beyond the two scopes above</div>
          </div>
        </Card>
      </div>
    </>
  );
}

export function AddSourceConfigureBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header
        item={item}
        actions={<button className="final-btn final-btn-primary">Add Source</button>}
      />
      <Tabs
        labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
        active={2}
      />
      <div className="final-two">
        <Card title="GitHub Configuration">
          <div className="final-stack compact">
            <label className="final-ref-field">
              <span>Repository</span>
              <div className="final-ref-input">tsaiggo/verto-handbook</div>
            </label>
            <label className="final-ref-field">
              <span>Branch</span>
              <div className="final-ref-input">main</div>
            </label>
            <label className="final-ref-field">
              <span>Content path</span>
              <div className="final-ref-input">content</div>
            </label>
            <label className="final-ref-field">
              <span>Include patterns</span>
              <div className="final-ref-input">*.md, *.mdx</div>
            </label>
            <label className="final-ref-field">
              <span>Exclude patterns</span>
              <div className="final-ref-input">drafts/**, .obsidian/**</div>
            </label>
          </div>
          <div className="final-actions right">
            <button className="final-btn final-btn-primary">Continue</button>
          </div>
        </Card>
        <Card title="Import preview">
          <div className="final-stack compact">
            <div className="final-row">
              <span>
                <strong>docs/</strong>
                <small>48 documents</small>
              </span>
              <span>2.4 MB</span>
            </div>
            <div className="final-row">
              <span>
                <strong>notes/</strong>
                <small>96 documents</small>
              </span>
              <span>1.1 MB</span>
            </div>
            <div className="final-row">
              <span>
                <strong>guides/</strong>
                <small>26 documents</small>
              </span>
              <span>820 KB</span>
            </div>
            <div className="final-row">
              <span>
                <strong>components/</strong>
                <small>16 documents</small>
              </span>
              <span>360 KB</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

export function AddSourceSelectContentBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header
        item={item}
        actions={<button className="final-btn final-btn-primary">Add Source</button>}
      />
      <Tabs
        labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
        active={3}
      />
      <div className="final-two">
        <Card title="Select folders">
          <div className="final-stack compact">
            {[
              ["✓ docs/", "48 documents · 2.4 MB"],
              ["✓ notes/", "96 documents · 1.1 MB"],
              ["○ guides/", "26 documents · 820 KB"],
              ["✓ components/", "16 documents · 360 KB"],
              ["○ drafts/", "8 documents · excluded"],
            ].map(([label, meta]) => (
              <div key={label} className="final-row">
                <span>
                  <strong>{label}</strong>
                  <small>{meta}</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Estimated import">
          <div className="final-stack compact">
            <div>
              <strong>160 documents</strong>
              <small> · 3.9 MB total</small>
            </div>
            <div>
              <strong>~24 seconds</strong>
              <small> initial sync</small>
            </div>
            <div>
              <strong>Local index</strong>
              <small> stays on this device</small>
            </div>
          </div>
          <div className="final-actions right">
            <button className="final-btn final-btn-primary">Start Sync</button>
          </div>
        </Card>
      </div>
    </>
  );
}

export function AddSourceSyncBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} actions={<button className="final-btn">Continue in background</button>} />
      <Tabs
        labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
        active={4}
      />
      <Card title="Initial sync in progress">
        <p className="final-lede">Reading files, indexing headings, extracting tags and links.</p>
        <div className="final-progress">
          <span style={{ width: "62%" }} />
        </div>
        <div className="final-stack compact">
          <div className="final-row">
            <span>
              <strong>Fetching content</strong>
              <small>docs/, notes/, components/</small>
            </span>
            <span className="final-pill is-synced">Done</span>
          </div>
          <div className="final-row">
            <span>
              <strong>Building index</strong>
              <small>Headings, tags, wikilinks</small>
            </span>
            <span className="final-pill is-pending">Running</span>
          </div>
          <div className="final-row">
            <span>
              <strong>Computing summaries</strong>
              <small>Optional · runs after index</small>
            </span>
            <span className="final-pill">Queued</span>
          </div>
        </div>
      </Card>
    </>
  );
}

export function AddSourceCompleteBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <Tabs
        labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
        active={5}
      />
      <div className="final-two">
        <Card title="Source connected">
          <p className="final-lede">tsaiggo/verto-handbook is indexed and ready.</p>
          <div className="final-stack compact">
            <div className="final-row">
              <span>
                <strong>160 documents</strong>
                <small>Indexed and searchable</small>
              </span>
              <span className="final-pill is-synced">Synced</span>
            </div>
            <div className="final-row">
              <span>
                <strong>1,842 tags</strong>
                <small>Extracted and grouped</small>
              </span>
              <span className="final-pill is-synced">Ready</span>
            </div>
            <div className="final-row">
              <span>
                <strong>324 backlinks</strong>
                <small>Resolved across the corpus</small>
              </span>
              <span className="final-pill is-synced">Ready</span>
            </div>
          </div>
          <div className="final-actions right">
            <button className="final-btn">Add another source</button>
            <button className="final-btn final-btn-primary">Open library</button>
          </div>
        </Card>
        <Card title="Next steps">
          <div className="final-stack compact">
            <div>Open a document · /read</div>
            <div>Browse the library · /library</div>
            <div>Try the agent · /agent</div>
          </div>
        </Card>
      </div>
    </>
  );
}

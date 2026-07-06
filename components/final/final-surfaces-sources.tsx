// /final product surfaces: sources & git connect (wizard steps + source mgmt).
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { sourceRows } from "@/components/final/final-fixtures";
import { Card, Header, Tabs } from "@/components/final/final-primitives";
import { GitSurface } from "@/components/final/final-surfaces-ops";
import {
  AddSourceChooseBoard,
  AddSourceCompleteBoard,
  AddSourceConfigureBoard,
  AddSourceConnectBoard,
  AddSourceSelectContentBoard,
  AddSourceSyncBoard,
} from "@/components/final/final-surfaces-source-wizard";

function SourceDetailBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header
        item={item}
        actions={
          <>
            <button className="final-btn">Reindex</button>
            <button className="final-btn">Settings</button>
          </>
        }
      />
      <div className="final-two">
        <Card title="tsaiggo/verto-handbook">
          <div className="final-stack compact">
            <div className="final-row">
              <span>
                <strong>Type</strong>
                <small>GitHub · main branch</small>
              </span>
              <span className="final-pill is-synced">Synced</span>
            </div>
            <div className="final-row">
              <span>
                <strong>Documents</strong>
                <small>160 files · 3.9 MB</small>
              </span>
              <span>160</span>
            </div>
            <div className="final-row">
              <span>
                <strong>Last synced</strong>
                <small>3 minutes ago</small>
              </span>
              <span className="final-pill is-synced">Fresh</span>
            </div>
          </div>
        </Card>
        <Card title="Sync history">
          <div className="final-stack compact">
            {[
              ["3m ago", "Incremental · 4 changes"],
              ["1h ago", "Incremental · 12 changes"],
              ["Yesterday 18:04", "Full sync · 160 files"],
              ["2d ago", "Incremental · 3 changes"],
            ].map(([when, what]) => (
              <div key={when} className="final-row">
                <span>
                  <strong>{when}</strong>
                  <small>{what}</small>
                </span>
                <span className="final-pill is-synced">OK</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function SourceHealthBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <div className="final-two">
        <Card title="Storage per source">
          <div className="final-stack compact">
            {[
              ["Local Folder", "1.4 GB", "68%"],
              ["GitHub · verto-handbook", "3.9 MB", "12%"],
              ["OneDrive · Personal", "82 MB", "9%"],
              ["Web / RSS", "18 MB", "6%"],
              ["Imported files", "24 MB", "5%"],
            ].map(([name, size, pct]) => (
              <div key={name} className="final-row">
                <span>
                  <strong>{name}</strong>
                  <small>{size}</small>
                </span>
                <span className="final-pill">{pct}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Sync health">
          <div className="final-stack compact">
            <div className="final-row">
              <span>
                <strong>All sources</strong>
                <small>5 healthy · 1 syncing · 0 errors</small>
              </span>
              <span className="final-pill is-synced">OK</span>
            </div>
            <div className="final-row">
              <span>
                <strong>Index freshness</strong>
                <small>Last full sweep 3 minutes ago</small>
              </span>
              <span className="final-pill is-synced">Fresh</span>
            </div>
            <div className="final-row">
              <span>
                <strong>Storage remaining</strong>
                <small>18 GB free on this device</small>
              </span>
              <span className="final-pill">OK</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function SourcesOverviewBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header
        item={item}
        actions={<button className="final-btn final-btn-primary">Add Source</button>}
      />
      <Tabs labels={["All Sources", "Connected", "Disconnected"]} active={0} />
      <div className="final-table">
        {sourceRows.map(([name, path, type, status, count]) => (
          <div key={name} className="final-table-row">
            <strong>{name}</strong>
            <span>{path}</span>
            <span>{type}</span>
            <span className={`final-pill is-${status.toLowerCase()}`}>{status}</span>
            <span>{count}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function SourcesSurface({ item }: { item: FinalPackItem }) {
  const git =
    item.id.includes("git") || item.id.includes("conflict") || item.id.includes("branches");
  if (git) return <GitSurface item={item} />;
  if (item.id === "59_add-source-choose") return <AddSourceChooseBoard item={item} />;
  if (item.id === "60_add-source-connect") return <AddSourceConnectBoard item={item} />;
  if (item.id === "61_add-source-configure") return <AddSourceConfigureBoard item={item} />;
  if (item.id === "62_add-source-select-content")
    return <AddSourceSelectContentBoard item={item} />;
  if (item.id === "63_add-source-initial-sync") return <AddSourceSyncBoard item={item} />;
  if (item.id === "64_add-source-complete") return <AddSourceCompleteBoard item={item} />;
  if (item.id === "65_source-detail") return <SourceDetailBoard item={item} />;
  if (item.id === "66_source-health") return <SourceHealthBoard item={item} />;
  return <SourcesOverviewBoard item={item} />;
}

import Link from "next/link";
import { ArrowRight, FileText, ListChecks, Tags } from "lucide-react";
import type { HomeLibraryOverview, HomeStatusBoard, HomeStatusColumn } from "@/lib/home";

export default function LibraryOverview({
  overview,
  board,
}: {
  overview: HomeLibraryOverview;
  board: HomeStatusBoard;
}) {
  return (
    <section id="library-overview" className="home-panel" aria-labelledby="library-overview-title">
      <div className="home-panel-head">
        <div>
          <h2 className="home-panel-title" id="library-overview-title">
            Library overview
          </h2>
          <p className="home-panel-sub">
            A reading-workflow board grouped by each document&rsquo;s <code>status</code>.
          </p>
        </div>
        <Link href="/search" className="home-viewall">
          Search library
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="home-overview-grid">
        <OverviewStat
          icon={FileText}
          label="Documents"
          value={overview.totalDocuments}
          detail="Readable MD/MDX files"
        />
        <OverviewStat
          icon={Tags}
          label="Tags"
          value={overview.tagCount}
          detail={`${overview.taggedDocuments} tagged document${overview.taggedDocuments === 1 ? "" : "s"}`}
        />
        <OverviewStat
          icon={ListChecks}
          label="Statuses"
          value={overview.statusCount}
          detail="Optional workflow labels"
        />
      </div>

      {board.total > 0 ? (
        <div className="home-board" aria-label="Reading workflow board">
          {board.columns.map((column) => (
            <StatusColumn key={column.id} column={column} />
          ))}
        </div>
      ) : (
        <p className="home-empty">
          Add a <code>status</code> to frontmatter (for example <code>reading</code> or{" "}
          <code>done</code>) to organize documents on this board.
        </p>
      )}
    </section>
  );
}

function OverviewStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="home-overview-stat">
      <span className="home-overview-icon" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <span className="home-overview-value">{value}</span>
      <span className="home-overview-label">{label}</span>
      <span className="home-overview-detail">{detail}</span>
    </div>
  );
}

function StatusColumn({ column }: { column: HomeStatusColumn }) {
  return (
    <div className={`home-board-col is-${column.id}`}>
      <div className="home-board-col-head">
        <span className="home-board-col-title">{column.label}</span>
        <span className="home-board-col-count">{column.cards.length}</span>
      </div>
      {column.cards.length > 0 ? (
        <ul className="home-board-cards">
          {column.cards.map((card) => (
            <li key={card.href}>
              <Link href={card.href} className="home-board-card">
                <span className="home-board-card-title">{card.title}</span>
                <span className="home-board-card-path">{card.path}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-board-empty">Nothing here yet.</p>
      )}
    </div>
  );
}

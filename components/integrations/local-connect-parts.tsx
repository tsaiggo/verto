import { AlertTriangle, CircleCheck, Clock, FolderOpen, Loader2 } from "lucide-react";
import type { InspectionSummary } from "@/lib/local-folder";
import { DEFAULT_FILE_FILTER } from "@/lib/connection-info";

interface FolderFieldProps {
  folder: string;
  desktop: boolean;
  picking: boolean;
  inspecting: boolean;
  summary: InspectionSummary | null;
  onFolderChange: (val: string) => void;
  setSummary: (val: InspectionSummary | null) => void;
  inspect: (val: string) => Promise<void>;
  onChoose: () => Promise<void>;
}

export function FolderField({
  folder,
  desktop,
  picking,
  inspecting,
  summary,
  onFolderChange,
  setSummary,
  inspect,
  onChoose,
}: FolderFieldProps) {
  return (
    <div className="connect-field">
      <label className="connect-field-label" htmlFor="local-folder">
        Folder
      </label>
      <div className="connect-field-control">
        <div className="connect-folder-row">
          <input
            id="local-folder"
            className="connect-input"
            value={folder}
            placeholder={desktop ? "No folder chosen" : "/path/to/content"}
            spellCheck={false}
            onChange={(e) => {
              onFolderChange(e.target.value);
              setSummary(null);
            }}
            onBlur={(e) => void inspect(e.target.value)}
          />
          <button
            type="button"
            className="connect-folder-choose"
            onClick={() => void onChoose()}
            disabled={!desktop || picking}
          >
            {picking ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FolderOpen className="h-4 w-4" aria-hidden />
            )}
            Choose folder…
          </button>
        </div>
        {desktop && (inspecting || summary) ? (
          <p
            className={`connect-folder-status is-${inspecting ? "checking" : summary!.tone}`}
            role="status"
          >
            {inspecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Checking folder…
              </>
            ) : summary!.tone === "ok" ? (
              <>
                <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                {summary!.message}
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {summary!.message}
              </>
            )}
          </p>
        ) : (
          <p className="connect-field-help">
            {desktop
              ? "Pick a folder of .mdx / .md files on this device to open."
              : "Folder picking is available in the Verto desktop app. Enter a path manually here."}
          </p>
        )}
      </div>
    </div>
  );
}

interface RecentFoldersFieldProps {
  recent: string[];
  onPickRecent: (val: string) => void;
}

export function RecentFoldersField({ recent, onPickRecent }: RecentFoldersFieldProps) {
  if (recent.length === 0) return null;

  return (
    <div className="connect-field">
      <span className="connect-field-label">Recent folders</span>
      <div className="connect-field-control">
        <ul className="connect-recent-list">
          {recent.map((value) => (
            <li key={value}>
              <button
                type="button"
                className="connect-recent-item"
                onClick={() => onPickRecent(value)}
                title={value}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden />
                <span className="connect-recent-path">{value}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="connect-field-help">
          Folders you have opened on this device. Click one to re-open it.
        </p>
      </div>
    </div>
  );
}

export function FileFilterField() {
  return (
    <div className="connect-field">
      <span className="connect-field-label">File filter</span>
      <div className="connect-field-control">
        <div className="connect-input-wrap">
          <input
            className="connect-input"
            defaultValue={DEFAULT_FILE_FILTER}
            readOnly
            aria-readonly
            spellCheck={false}
          />
        </div>
        <p className="connect-field-help">
          Only files matching this pattern are read. Supports .mdx and .md only.
        </p>
      </div>
    </div>
  );
}

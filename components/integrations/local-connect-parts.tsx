import { AlertTriangle, CircleCheck, Clock, FolderOpen, Loader2 } from "lucide-react";
import type { InspectionSummary } from "@/lib/local-folder";
import type { RuntimeLocalPickerMode } from "@/lib/runtime-local-folder";
import { DEFAULT_FILE_FILTER } from "@/lib/connection-info";
import styles from "./Sources.module.css";

interface FolderFieldProps {
  folder: string;
  pickerMode: RuntimeLocalPickerMode;
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
  pickerMode,
  picking,
  inspecting,
  summary,
  onFolderChange,
  setSummary,
  inspect,
  onChoose,
}: FolderFieldProps) {
  const pickerAvailable = pickerMode !== "unavailable";

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor="local-folder">
        Folder
      </label>
      <div className={styles.fieldControl}>
        <div className={styles.folderRow}>
          <input
            id="local-folder"
            className={styles.input}
            value={folder}
            placeholder={pickerAvailable ? "No folder chosen" : "/path/to/content"}
            spellCheck={false}
            disabled={!pickerAvailable}
            readOnly={pickerMode === "desktop"}
            aria-readonly={pickerMode === "desktop"}
            onChange={(e) => {
              onFolderChange(e.target.value);
              setSummary(null);
            }}
            onBlur={(e) => void inspect(e.target.value)}
          />
          <button
            type="button"
            className={styles.chooseButton}
            onClick={() => void onChoose()}
            disabled={!pickerAvailable || picking}
          >
            {picking ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FolderOpen className="h-4 w-4" aria-hidden />
            )}
            Choose folder…
          </button>
        </div>
        {pickerAvailable && (inspecting || summary) ? (
          <p
            className={styles.folderStatus}
            data-tone={inspecting ? "checking" : summary!.tone}
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
          <p className={styles.fieldHelp}>{folderHelpText(pickerMode)}</p>
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
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Recent folders</span>
      <div className={styles.fieldControl}>
        <ul className={styles.recentList}>
          {recent.map((value) => (
            <li key={value}>
              <button
                type="button"
                className={styles.recentButton}
                onClick={() => onPickRecent(value)}
                title={value}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden />
                <span className={styles.recentPath}>{value}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.fieldHelp}>
          Folders you have opened on this device. Click one to re-open it.
        </p>
      </div>
    </div>
  );
}

export function FileFilterField() {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor="local-file-filter">
        File filter
      </label>
      <div className={styles.fieldControl}>
        <div className={styles.inputWrap}>
          <input
            id="local-file-filter"
            className={styles.input}
            defaultValue={DEFAULT_FILE_FILTER}
            readOnly
            aria-readonly
            spellCheck={false}
          />
        </div>
        <p className={styles.fieldHelp}>
          Only files matching this pattern are read. Supports .mdx and .md only.
        </p>
      </div>
    </div>
  );
}

function folderHelpText(mode: RuntimeLocalPickerMode): string {
  if (mode === "desktop") return "Pick a folder of .mdx / .md files on this device to open.";
  if (mode === "browser") {
    return "Pick a folder for this browser preview. Verto caches readable files locally in this browser.";
  }
  return "Folder picking is available in the Verto desktop app or a modern browser.";
}

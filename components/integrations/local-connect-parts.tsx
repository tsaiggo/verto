import { AlertTriangle, CircleCheck, Clock, FolderOpen, Loader2 } from "lucide-react";
import type { InspectionSummary } from "@/lib/local-folder";
import type { RuntimeLocalPickerMode } from "@/lib/runtime-local-folder";
import { DEFAULT_FILE_FILTER } from "@/lib/connection-info";
import styles from "./Sources.module.css";

interface FolderFieldProps {
  folder: string;
  pickerMode: RuntimeLocalPickerMode;
  picking: boolean;
  disabled: boolean;
  summary: InspectionSummary | null;
  onFolderChange: (value: string) => void;
  setSummary: (value: InspectionSummary | null) => void;
  onChoose: () => Promise<void>;
}

export function FolderField({
  folder,
  pickerMode,
  picking,
  disabled,
  summary,
  onFolderChange,
  setSummary,
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
            placeholder={pickerAvailable ? "No folder chosen" : "Folder access unavailable"}
            spellCheck={false}
            disabled={!pickerAvailable || disabled}
            readOnly
            aria-readonly="true"
            onChange={(event) => {
              onFolderChange(event.target.value);
              setSummary(null);
            }}
          />
          <button
            type="button"
            className={styles.chooseButton}
            onClick={() => void onChoose()}
            disabled={!pickerAvailable || disabled}
            aria-busy={picking}
          >
            {picking ? <Loader2 className={styles.spin} aria-hidden /> : <FolderOpen aria-hidden />}
            {pickerMode === "browser" ? "Choose and connect" : "Choose folder"}
          </button>
        </div>
        {summary ? (
          <p className={styles.folderStatus} data-tone={summary.tone} role="status">
            {summary.tone === "ok" ? <CircleCheck aria-hidden /> : <AlertTriangle aria-hidden />}
            {summary.message}
          </p>
        ) : (
          <p className={styles.fieldHelp}>{folderHelpText(pickerMode, folder)}</p>
        )}
      </div>
    </div>
  );
}

interface RecentFoldersFieldProps {
  recent: string[];
  disabled?: boolean;
  onPickRecent: (value: string) => void;
}

export function RecentFoldersField({
  recent,
  disabled = false,
  onPickRecent,
}: RecentFoldersFieldProps) {
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
                className={styles.recentItem}
                onClick={() => onPickRecent(value)}
                title={`Reconnect ${value}`}
                disabled={disabled}
              >
                <Clock aria-hidden />
                <span>{value}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.fieldHelp}>
          Reconnect a folder Verto has already opened on this device.
        </p>
      </div>
    </div>
  );
}

export function FileFilterField() {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Readable files</span>
      <div className={styles.fieldControl}>
        <div className={styles.filterRule}>
          <code>{DEFAULT_FILE_FILTER}</code>
          <span>Fixed rule</span>
        </div>
        <p className={styles.fieldHelp}>
          Verto reads Markdown and MDX files. Other file types remain untouched.
        </p>
      </div>
    </div>
  );
}

function folderHelpText(mode: RuntimeLocalPickerMode, folder: string): string {
  if (folder.trim()) {
    return mode === "desktop"
      ? "Folder selected. Connect it to inspect and use its Markdown files."
      : "Folder selected and cached for preview. Connect it to make it the live Library.";
  }
  if (mode === "desktop") return "Choose a folder of Markdown or MDX files on this device.";
  if (mode === "browser") {
    return "Choose and connect a folder. Verto caches its readable files in this browser.";
  }
  return "Folder access is available in Verto desktop and supported browsers.";
}

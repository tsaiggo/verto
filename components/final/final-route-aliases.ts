export const AGENT_STATE_TO_ID: Record<string, string> = {
  changes: "06_agent-changes-preview",
  running: "49_agent-run-in-progress",
  tool: "50_agent-tool-call-detail",
  approval: "51_agent-write-approval",
  approvals: "52_agent-pending-approvals",
  unavailable: "53_agent-provider-unavailable",
  "no-api-key": "54_agent-no-api-key",
  partial: "55_agent-partial-completion",
  applied: "56_agent-change-applied",
  permissions: "57_agent-permissions",
};

export const EDITOR_STATE_TO_ID: Record<string, string> = {
  split: "04_split-view-read-edit",
  inserter: "41_editor-component-inserter",
  problems: "42_editor-problems",
  unsaved: "43_editor-unsaved",
  "save-failed": "44_editor-save-failed",
  history: "45_editor-version-history",
  new: "46_editor-new-document",
  menu: "47_editor-context-menu",
  command: "48_editor-command-palette",
};

export const INTEGRATION_STATE_TO_ID: Record<string, string> = {
  overview: "58_sources-overview",
  "add/choose": "59_add-source-choose",
  "add/connect": "60_add-source-connect",
  "add/configure": "61_add-source-configure",
  "add/select-content": "62_add-source-select-content",
  "add/sync": "63_add-source-initial-sync",
  "add/complete": "64_add-source-complete",
  "source/detail": "65_source-detail",
  "source/health": "66_source-health",
  "no-source": "83_no-source-connected",
  syncing: "85_syncing-state",
  "sync-failed": "86_sync-failed",
  "permission-denied": "87_permission-denied",
};

export const GIT_STATE_TO_ID: Record<string, string> = {
  changes: "08_git-changes",
  diff: "67_git-side-by-side-diff",
  commit: "68_git-commit",
  branches: "69_git-branches-history",
  conflict: "70_git-conflict-resolution",
};

export const ONBOARDING_STATE_TO_ID: Record<string, string> = {
  welcome: "71_onboarding-welcome",
  source: "72_onboarding-connect-source",
  ai: "73_onboarding-connect-ai",
  ready: "74_onboarding-ready",
};

export const SETTINGS_STATE_TO_ID: Record<string, string> = {
  general: "75_settings-general",
  appearance: "76_settings-appearance",
  editor: "77_settings-editor",
  reading: "78_settings-reading",
  agent: "79_settings-agent",
  privacy: "80_settings-privacy",
  shortcuts: "81_settings-shortcuts",
  about: "82_settings-about",
};

export const SYSTEM_STATE_TO_ID: Record<string, string> = {
  "empty-library": "15_empty-library",
  "search-empty": "16_search-no-results",
  "activity-empty": "17_no-activity-yet",
  offline: "18_no-internet-connection",
  loading: "84_loading-skeleton",
  syncing: "85_syncing-state",
  "sync-failed": "86_sync-failed",
  "permission-denied": "87_permission-denied",
  "large-file": "88_large-file-warning",
  readonly: "89_archived-readonly",
  trash: "90_trash-state",
  accessibility: "91_accessibility-reference",
};

export function slugPath(parts?: string[]): string {
  return (parts?.length ? parts : ["overview"]).join("/");
}

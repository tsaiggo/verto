export interface FinalPackItem {
  id: string;
  title: string;
  category: string;
  state: string;
  sourceBoard: string;
  notes: string;
}

const rows = [
  ["00_design-system-reference", "Design System Reference", "Foundation", "Reference", "00/01", "Overview reference rebuilt in HTML."],
  ["01_home-dashboard", "Home Dashboard", "Core Product", "Default", "00", "Primary home and activity overview."],
  ["02_reader-read-mode", "Reader - Read Mode", "Reader", "Default", "00/02", "Immersive document reading."],
  ["03_editor-mdx-mode", "Editor - MDX Mode", "Editor", "Default", "00/03", "Source editor with frontmatter."],
  ["04_split-view-read-edit", "Split View", "Editor", "Split", "00/03", "Editor and rendered preview."],
  ["05_agent-chat-contextual", "Agent Chat", "Agent", "Default", "00/04", "Grounded contextual conversation."],
  ["06_agent-changes-preview", "Agent Changes Preview", "Agent", "Approval", "00/04", "Proposed file changes."],
  ["07_sources-integrations", "Sources & Integrations", "Sources & Git", "Default", "00/06", "Connected source overview."],
  ["08_git-changes", "Git Changes", "Sources & Git", "Default", "00/06", "Uncommitted changes."],
  ["09_graph-view", "Graph View", "Library & Knowledge", "Default", "00/05", "Knowledge relationships."],
  ["10_activity-full-view", "Activity", "Library & Knowledge", "Default", "00/05", "Knowledge rhythm and metrics."],
  ["11_inbox-triage", "Inbox / Triage", "Library & Knowledge", "Default", "00/05", "Incoming work and approvals."],
  ["12_responsive-desktop", "Responsive - Desktop", "Responsive", "Desktop", "00/07", "Wide desktop behavior."],
  ["13_responsive-tablet", "Responsive - Tablet", "Responsive", "Tablet", "00/07", "Tablet layout behavior."],
  ["14_responsive-mobile", "Responsive - Mobile", "Mobile", "Mobile", "00/07", "Narrow window behavior."],
  ["15_empty-library", "Empty Library", "Onboarding & States", "Empty", "00/07", "No documents yet."],
  ["16_search-no-results", "Search - No Results", "Onboarding & States", "Empty", "00/07", "No matching search results."],
  ["17_no-activity-yet", "Activity - Empty", "Onboarding & States", "Empty", "00/07", "No activity yet."],
  ["18_no-internet-connection", "Offline", "Onboarding & States", "Offline", "00/07", "No internet connection."],
  ["19_dark-mode-preview", "Dark Mode Reader", "Responsive", "Dark", "00/07", "Dark theme product view."],
  ["20_keyboard-shortcuts", "Keyboard Shortcuts", "Settings", "Reference", "00/07", "Shortcut reference."],
  ["21_design-tokens", "Design Tokens", "Foundation", "Reference", "01", "Canonical implementation tokens."],
  ["22_component-library", "Core Component Library", "Foundation", "Reference", "01", "Component primitives and visual states."],
  ["23_app-shell-anatomy", "App Shell Anatomy", "Foundation", "Reference", "01", "Desktop shell regions and dimensions."],
  ["24_library-browse", "Library Browse", "Library & Knowledge", "Default", "05", "Primary library browser."],
  ["25_search-results", "Search Results", "Library & Knowledge", "Results", "05", "Filtered search results and relevance ranking."],
  ["26_bookmarks", "Bookmarks", "Library & Knowledge", "Default", "05", "Saved documents and external resources."],
  ["27_tags", "Tags", "Library & Knowledge", "Default", "05", "Tag overview and usage counts."],
  ["28_collections", "Collections", "Library & Knowledge", "Default", "05", "Collection overview cards."],
  ["29_knowledge-studio", "Knowledge Studio", "Library & Knowledge", "Cards", "05", "Knowledge card workspace."],
  ["30_knowledge-card-detail", "Knowledge Card Detail", "Library & Knowledge", "Detail", "05", "Knowledge card detail and provenance."],
  ["31_collection-detail", "Collection Detail", "Library & Knowledge", "Detail", "05", "Collection items and related groups."],
  ["32_daily-digest", "Daily / Weekly Digest", "Library & Knowledge", "Generated", "05", "Generated digest and source-linked insights."],
  ["33_reader-selection", "Reader - Selection Toolbar", "Reader & Annotation", "Text selected", "02", "Selected text with contextual actions."],
  ["34_reader-note-popover", "Reader - Add Note Popover", "Reader & Annotation", "Popover open", "02", "Note composer anchored to selected passage."],
  ["35_reader-notes-rail", "Reader - Notes Rail", "Reader & Annotation", "Notes tab", "02", "Notes rail with anchored annotations."],
  ["36_reader-backlinks", "Reader - Backlinks & Related", "Reader & Annotation", "Links tab", "02", "Backlinks and related passages."],
  ["37_reader-agent-summary", "Reader - Agent Summary", "Reader & Annotation", "Agent tab", "02", "Contextual summary with citations."],
  ["38_reader-focus-mode", "Reader - Focus Mode", "Reader & Annotation", "Focus mode", "02", "Distraction-free reader with hidden rails."],
  ["39_reader-loading", "Reader - Loading Skeleton", "Reader & Annotation", "Loading", "02/07", "Layout-preserving reader loading state."],
  ["40_reader-failed-render", "Reader - Failed MDX Render", "Reader & Annotation", "Error", "02/07", "Unknown MDX component fallback."],
  ["41_editor-component-inserter", "Editor - Component Inserter", "Editor & MDX Authoring", "Slash menu open", "03", "Slash-command MDX component inserter."],
  ["42_editor-problems", "Editor - Problems Panel", "Editor & MDX Authoring", "Problems tab", "03", "Parser, lint and accessibility problems."],
  ["43_editor-unsaved", "Editor - Unsaved Changes", "Editor & MDX Authoring", "Unsaved", "03", "Unsaved indicators in tab and status bar."],
  ["44_editor-save-failed", "Editor - Save Failed", "Editor & MDX Authoring", "Error", "03/07", "Save failure toast and retry."],
  ["45_editor-version-history", "Editor - Version History", "Editor & MDX Authoring", "History open", "03", "Local history and restore workflow."],
  ["46_editor-new-document", "Editor - New Document", "Editor & MDX Authoring", "Modal open", "03", "New file or folder creation dialog."],
  ["47_editor-context-menu", "Editor - File Context Menu", "Editor & MDX Authoring", "Context menu", "03", "Rename, move, duplicate and delete actions."],
  ["48_editor-command-palette", "Editor - Command Palette", "Editor & MDX Authoring", "Command palette", "03/07", "Keyboard-first command palette."],
  ["49_agent-run-in-progress", "Agent Run - In Progress", "Agent", "Running", "04", "Agent execution with visible stages, context, pause and stop controls."],
  ["50_agent-tool-call-detail", "Agent Tool Call Detail", "Agent", "Popover / Detail", "04", "Auditable tool-call input, result, duration and status."],
  ["51_agent-write-approval", "Agent Write Approval", "Agent", "Waiting for Approval", "04", "Multi-file approval with diff, rationale, citations and explicit consent."],
  ["52_agent-pending-approvals", "Agent Pending Approvals", "Agent", "Queue", "04", "Central queue for pending write permissions."],
  ["53_agent-provider-unavailable", "Agent Provider Unavailable", "Agent", "Error", "04", "Recoverable provider outage state."],
  ["54_agent-no-api-key", "Agent - No API Key", "Agent", "Blocked", "04", "AI-disabled state that keeps non-AI product functionality available."],
  ["55_agent-partial-completion", "Agent Run - Partial Completion", "Agent", "Partial Success", "04", "Partial-success recovery options and transparent limitations."],
  ["56_agent-change-applied", "Agent Change Applied", "Agent", "Success / Undo", "04", "Success confirmation with reversible undo."],
  ["57_agent-permissions", "Agent Model & Permissions", "Agent", "Settings", "04", "Fine-grained model and tool permissions."],
  ["58_sources-overview", "Sources Overview", "Sources & Git", "Default", "06", "Connected source inventory and status."],
  ["59_add-source-choose", "Add Source - Choose Type", "Sources & Git", "Step 1", "06", "Unified source-type selection."],
  ["60_add-source-connect", "Add Source - Connect", "Sources & Git", "Step 2", "06", "OAuth connection and permission disclosure."],
  ["61_add-source-configure", "Add Source - Configure", "Sources & Git", "Step 3", "06", "Repository, branch, filters and indexing options."],
  ["62_add-source-select-content", "Add Source - Select Content", "Sources & Git", "Step 4", "06", "Folder selection and estimated import impact."],
  ["63_add-source-initial-sync", "Add Source - Initial Sync", "Sources & Git", "Step 5 / Running", "06", "Initial ingestion progress with background continuation."],
  ["64_add-source-complete", "Add Source - Complete", "Sources & Git", "Step 6 / Success", "06", "Successful source onboarding completion."],
  ["65_source-detail", "Source Detail & Sync Activity", "Sources & Git", "Detail", "06", "Single-source detail and sync history."],
  ["66_source-health", "Source Health & Storage", "Sources & Git", "Monitoring", "06", "Aggregate source health and storage."],
  ["67_git-side-by-side-diff", "Git File Diff - Side by Side", "Sources & Git", "Diff", "06", "Side-by-side file diff."],
  ["68_git-commit", "Git Commit Changes", "Sources & Git", "Commit", "06", "Commit form with staged files and optional push."],
  ["69_git-branches-history", "Git Branches & History", "Sources & Git", "Branches", "06", "Branches, commit timeline, compare and merge."],
  ["70_git-conflict-resolution", "Git Conflict Resolution", "Sources & Git", "Conflict", "06", "Three-way merge conflict resolution."],
  ["71_onboarding-welcome", "Onboarding - Welcome", "Onboarding & States", "Step 1", "07", "First-run welcome and product promise."],
  ["72_onboarding-connect-source", "Onboarding - Connect Source", "Onboarding & States", "Step 2", "07", "Onboarding source choice."],
  ["73_onboarding-connect-ai", "Onboarding - Connect AI", "Onboarding & States", "Step 3", "07", "Provider/model/API connection with privacy disclosure."],
  ["74_onboarding-ready", "Onboarding - Ready", "Onboarding & States", "Step 4", "07", "Successful onboarding finish and next actions."],
  ["75_settings-general", "General Settings", "Settings", "Default", "07", "General workspace preferences."],
  ["76_settings-appearance", "Appearance Settings", "Settings", "Default", "07", "Theme, accent, density and live preview."],
  ["77_settings-editor", "Editor Settings", "Settings", "Default", "07", "Code editor and authoring behavior."],
  ["78_settings-reading", "Reading Settings", "Settings", "Default", "07", "Reader typography, width and annotation defaults."],
  ["79_settings-agent", "AI & Agent Settings", "Settings", "Default", "07", "AI provider and permission controls."],
  ["80_settings-privacy", "Privacy Settings", "Settings", "Default", "07", "Telemetry, retention and local-data controls."],
  ["81_settings-shortcuts", "Keyboard Shortcuts", "Settings", "Default", "07", "Keyboard-first command reference and customization."],
  ["82_settings-about", "About Verto", "Settings", "Default", "07", "Version, license and updates."],
  ["83_no-source-connected", "No Source Connected", "Onboarding & States", "Empty", "07", "Library without any configured source."],
  ["84_loading-skeleton", "Loading Skeleton", "Onboarding & States", "Loading", "07", "Full shell loading skeleton."],
  ["85_syncing-state", "Syncing State", "Onboarding & States", "Progress", "07", "Background indexing and partial availability."],
  ["86_sync-failed", "Sync Failed", "Onboarding & States", "Error", "07", "Detailed sync error diagnostics and recovery."],
  ["87_permission-denied", "Permission Denied", "Onboarding & States", "Blocked", "07", "Revoked source access with explicit product impact."],
  ["88_large-file-warning", "Large File Warning", "Onboarding & States", "Warning", "07", "Performance warning before opening a large file."],
  ["89_archived-readonly", "Archived / Read-only Document", "Onboarding & States", "Read-only", "07", "Archived document state with restore action."],
  ["90_trash-state", "Trash State", "Onboarding & States", "Trash", "07", "Soft-deleted content and permanent deletion actions."],
  ["91_accessibility-reference", "Accessibility Reference", "Onboarding & States", "Reference", "07", "Accessibility implementation reference."],
] as const;

export const FINAL_PACK_ITEMS: FinalPackItem[] = rows.map(
  ([id, title, category, state, sourceBoard, notes]) => ({
    id,
    title,
    category,
    state,
    sourceBoard,
    notes,
  })
);

export const FINAL_PACK_BY_ID = new Map(FINAL_PACK_ITEMS.map((item) => [item.id, item]));

export function getFinalPackItem(id: string): FinalPackItem | undefined {
  return FINAL_PACK_BY_ID.get(id);
}

export function categoryItems(category: string): FinalPackItem[] {
  return FINAL_PACK_ITEMS.filter((item) => item.category === category);
}

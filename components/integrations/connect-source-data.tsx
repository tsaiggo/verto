"use client";

// Static provider config + pure builders (fields, preview rows, checklist,
// setup steps) for the Connect-source view. No JSX; consumed by ConnectSourceView.
import {
  CircleCheck,
  Cloud,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Github,
  HardDrive,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { ConnectionDetails } from "@/lib/connection-info";
import { useAuth } from "@/components/auth/AuthProvider";

export type ProviderKind = "local" | "github" | "onedrive" | "googledrive";

export const PROVIDERS: {
  kind: ProviderKind;
  name: string;
  blurb: string;
  badge: string;
  note: string;
  icon: LucideIcon;
  iconClass: string;
  comingSoon?: boolean;
}[] = [
  {
    kind: "local",
    name: "Local Files",
    blurb: "Open a folder of .mdx / .md files from this device.",
    badge: "recommended",
    note: "No account required",
    icon: FolderOpen,
    iconClass: "is-local",
  },
  {
    kind: "github",
    name: "GitHub Repo",
    blurb: "Connect a public or private GitHub repository.",
    badge: "desktop",
    note: "Requires the desktop app",
    icon: Github,
    iconClass: "is-github",
    comingSoon: true,
  },
  {
    kind: "onedrive",
    name: "OneDrive",
    blurb: "Connect to your Microsoft OneDrive storage.",
    badge: "env",
    note: "Requires the desktop app",
    icon: Cloud,
    iconClass: "is-onedrive",
    comingSoon: true,
  },
  {
    kind: "googledrive",
    name: "Google Drive",
    blurb: "Google Drive support is not yet available.",
    badge: "soon",
    note: "Not yet supported",
    icon: HardDrive,
    iconClass: "is-googledrive",
    comingSoon: true,
  },
];

export interface FormField {
  id: string;
  label: string;
  /** "select" renders a chevron + (optional) verified check, "text" is plain. */
  type: "select" | "text";
  value: string;
  help?: string;
  verified?: boolean;
}

export interface PreviewRow {
  label: string;
  value: string;
  icon: LucideIcon;
  mono?: boolean;
}

/** Does the selected provider correspond to the actually-connected source? */
export function isConnectedProvider(
  provider: ProviderKind,
  connection: ConnectionDetails
): boolean {
  return connection.connected && connection.kind === provider;
}

export function initialProviderFor(connection: ConnectionDetails): ProviderKind {
  return PROVIDERS.some((p) => p.kind === connection.kind) ? connection.kind : "local";
}

/** Build the connection-form fields for a provider. */
export function fieldsFor(provider: ProviderKind, connection: ConnectionDetails): FormField[] {
  const connected = isConnectedProvider(provider, connection);

  if (provider === "github") {
    return [
      {
        id: "repository",
        label: "Repository",
        type: "select",
        value: connection.repo ?? "owner/repo",
        help: "Select a repository you have access to.",
        verified: connected,
      },
      {
        id: "branch",
        label: "Branch",
        type: "select",
        value: connection.branch ?? "main",
        help: "Select the branch to read from.",
        verified: connected,
      },
      {
        id: "path",
        label: "Content path",
        type: "text",
        value: connected ? connection.path : "/docs",
        help: "Path within the repository where your MDX content lives.",
      },
      {
        id: "filter",
        label: "File filter",
        type: "text",
        value: connection.filter,
        help: "Only files matching this pattern will be previewed. Supports .mdx and .md only.",
      },
    ];
  }

  if (provider === "onedrive") {
    return [
      {
        id: "account",
        label: "Account",
        type: "select",
        value: connected ? connection.name : "Connect an account",
        help: "Sign in with the Microsoft account that owns the files.",
        verified: connected,
      },
      {
        id: "path",
        label: "Folder path",
        type: "text",
        value: connected ? connection.path : "/Documents/MDX",
        help: "Folder inside OneDrive where your MDX content lives.",
      },
      {
        id: "filter",
        label: "File filter",
        type: "text",
        value: connection.filter,
        help: "Only files matching this pattern will be previewed. Supports .mdx and .md only.",
      },
    ];
  }

  return [
    {
      id: "account",
      label: "Account",
      type: "select",
      value: "Connect an account",
      help: "Sign in with the Google account that owns the files.",
    },
    {
      id: "folder",
      label: "Folder",
      type: "select",
      value: "Select a folder",
      help: "Choose the Drive folder to read from.",
    },
    {
      id: "filter",
      label: "File filter",
      type: "text",
      value: connection.filter,
      help: "Only files matching this pattern will be previewed. Supports .mdx and .md only.",
    },
  ];
}

/** Build the right-hand "Source preview" rows for a provider. */
export function previewRowsFor(
  provider: ProviderKind,
  connection: ConnectionDetails,
  fields: FormField[],
  localFolder: string
): PreviewRow[] {
  const byId = (id: string) => fields.find((f) => f.id === id)?.value ?? "—";
  const providerName = PROVIDERS.find((p) => p.kind === provider)?.name ?? provider;
  const providerLabel = provider === "github" ? "GitHub" : providerName;

  if (provider === "local") {
    return [
      { label: "Provider", value: "Local Files", icon: FolderOpen },
      {
        label: "Folder",
        value: localFolder.trim() || "—",
        icon: Folder,
        mono: true,
      },
      {
        label: "File filter",
        value: connection.filter,
        icon: GitCommitHorizontal,
        mono: true,
      },
      { label: "Preview mode", value: "Local preview", icon: HardDrive },
    ];
  }

  if (provider === "github") {
    return [
      { label: "Provider", value: providerLabel, icon: Github },
      {
        label: "Repository",
        value: byId("repository"),
        icon: Folder,
        mono: true,
      },
      { label: "Branch", value: byId("branch"), icon: GitBranch, mono: true },
      { label: "Path", value: byId("path"), icon: Folder, mono: true },
      {
        label: "File filter",
        value: byId("filter"),
        icon: GitCommitHorizontal,
        mono: true,
      },
      {
        label: "Preview mode",
        value: connection.previewMode,
        icon: RefreshCw,
      },
    ];
  }

  return [
    {
      label: "Provider",
      value: providerLabel,
      icon: provider === "onedrive" ? Cloud : HardDrive,
    },
    {
      label: "Folder",
      value: byId("path") ?? byId("folder"),
      icon: Folder,
      mono: true,
    },
    {
      label: "File filter",
      value: byId("filter"),
      icon: GitCommitHorizontal,
      mono: true,
    },
    { label: "Preview mode", value: "Remote preview", icon: RefreshCw },
  ];
}

export interface SetupStep {
  label: string;
  title: string;
  detail: string;
  tone: "done" | "active" | "todo";
}

export interface ChecklistItem {
  icon: LucideIcon;
  tone: "ok" | "sync" | "info";
  title: string;
  detail: string;
}

export function checklistFor(
  provider: ProviderKind,
  desktop: boolean,
  signedIn: boolean
): ChecklistItem[] {
  if (provider === "local") {
    return [
      {
        icon: FolderOpen,
        tone: "sync",
        title: desktop ? "Use the native picker" : "Enter a folder path",
        detail: desktop
          ? "Choose any folder on this computer and Verto will scan it for readable files."
          : "The browser build cannot open folders directly; use the desktop app for picker access.",
      },
      {
        icon: CircleCheck,
        tone: "ok",
        title: "Look for .md or .mdx",
        detail: "The scanner ignores dotfiles and non-readable assets so your library stays clean.",
      },
      {
        icon: RefreshCw,
        tone: "info",
        title: "Rebuild when changing sources",
        detail:
          "Verto is static-first, so source changes are applied during the next build/export.",
      },
    ];
  }

  if (provider === "github") {
    return [
      {
        icon: Github,
        tone: signedIn ? "ok" : "sync",
        title: signedIn ? "GitHub account ready" : "Sign in with GitHub",
        detail: signedIn
          ? "Pick a repository, branch, and content folder from your account."
          : "The desktop app uses GitHub device flow and stores the token on this device.",
      },
      {
        icon: GitBranch,
        tone: "info",
        title: "Verify the content path",
        detail: "Verto checks the selected repository path before saving the connection.",
      },
      {
        icon: CircleCheck,
        tone: "ok",
        title: "Private repos are supported",
        detail: "Use a signed-in desktop session when your MDX vault is not public.",
      },
    ];
  }

  return [
    {
      icon: Cloud,
      tone: "info",
      title: "Configure outside the app",
      detail: "OneDrive sources currently use environment variables and build-time validation.",
    },
    {
      icon: GitCommitHorizontal,
      tone: "sync",
      title: "Keep the MDX filter",
      detail: "Only .md and .mdx files are read into the generated site.",
    },
    {
      icon: RefreshCw,
      tone: "ok",
      title: "Rebuild to apply",
      detail: "After changing remote source settings, export the app again to refresh content.",
    },
  ];
}

export function setupStepsFor(
  selected: ProviderKind,
  auth: ReturnType<typeof useAuth>,
  localFolder: string,
  connection: ConnectionDetails
): SetupStep[] {
  const hasLocalFolder = localFolder.trim().length > 0;
  const hasSavedGitHubConnection = Boolean(auth.connection);
  const hasChosenVault =
    hasLocalFolder || connection.connected || (selected === "github" && hasSavedGitHubConnection);
  const hasReadableSource = connection.connected || hasLocalFolder || hasSavedGitHubConnection;
  return [
    {
      label: "01",
      title: "Choose your vault",
      detail:
        selected === "local"
          ? "Start with a folder on this computer."
          : "Pick the place where your MDX lives.",
      tone: hasChosenVault ? "done" : "active",
    },
    {
      label: "02",
      title: "Verify access",
      detail: auth.user
        ? `Signed in as @${auth.user.login}.`
        : auth.available
          ? "Sign in only if your vault is on GitHub."
          : "Desktop unlocks native folder and GitHub flows.",
      tone: auth.user || selected === "local" ? "done" : "active",
    },
    {
      label: "03",
      title: "Start reading",
      detail: hasReadableSource
        ? "Your reader has a source to render."
        : "Save the connection, then rebuild when needed.",
      tone: hasReadableSource ? "done" : "todo",
    },
  ];
}

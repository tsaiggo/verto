"use client";

// Rail account card — the GitHub account control at the foot of the sidebar.
//
// Replaces the old static "Verto Team / Pro Plan" card with the live GitHub
// identity that the whole desktop experience is built around. It mirrors the
// auth state from <AuthProvider>:
//
//   • signed in   → avatar + name/@login, with a sign-out menu
//   • signed out  → "Sign in with GitHub", which starts the device flow
//   • web build   → a disabled prompt explaining sign-in is desktop-only
//
// Outside Tauri the AuthProvider is inert (`available` === false), so the card
// degrades to an honest, non-interactive prompt rather than failing on click.

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth/AuthProvider";

/** First letter of a name/login, used as an avatar fallback. */
function initial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export default function RailAccount() {
  const { available, loading, user, signIn, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function onSignIn() {
    if (busy) return;
    setBusy(true);
    try {
      await signIn((info) => {
        toast.info(`Enter code ${info.userCode} on GitHub`, {
          description: "We opened the verification page in your browser.",
          duration: 30000,
        });
      });
      toast.success("Signed in to GitHub.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Sign-in failed: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    try {
      await signOut();
      toast.success("Signed out of GitHub.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Sign-out failed: ${message}`);
    }
  }

  // Signed in — show the GitHub identity with a sign-out menu.
  if (user) {
    const displayName = user.name ?? user.login;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="app-rail-account"
            aria-label={`Signed in as ${user.login}`}
            title={`Signed in as ${user.login}`}
          >
            <span className="app-rail-account-avatar" aria-hidden>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="app-rail-account-avatar-img" />
              ) : (
                initial(displayName)
              )}
            </span>
            <span className="app-rail-account-text">
              <span className="app-rail-account-name">{displayName}</span>
              <span className="app-rail-account-plan">@{user.login}</span>
            </span>
            <ChevronDown className="app-rail-account-chevron" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>
            {displayName}
            <span className="block text-xs text-text-muted">@{user.login}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Browser preview / signed-out sample state. The design mockups use a
  // populated account row; keep it non-authenticating when auth is unavailable.
  if (!available) {
    return (
      <button
        type="button"
        className="app-rail-account app-rail-account--sample"
        disabled
        aria-label="Sample account: Avery Morgan"
        title="Sample account"
      >
        <span className="app-rail-account-avatar" aria-hidden>
          A
        </span>
        <span className="app-rail-account-text">
          <span className="app-rail-account-name">Avery Morgan</span>
          <span className="app-rail-account-plan">avery@verto.so</span>
        </span>
        <ChevronDown className="app-rail-account-chevron" aria-hidden />
      </button>
    );
  }

  // Signed out — prompt to sign in (disabled while hydrating).
  const canSignIn = available && !loading && !busy;
  return (
    <button
      type="button"
      className="app-rail-account"
      onClick={onSignIn}
      disabled={!canSignIn}
      aria-label="Sign in with GitHub"
      title="Sign in with GitHub"
    >
      <span className="app-rail-account-avatar" aria-hidden>
        G
      </span>
      <span className="app-rail-account-text">
        <span className="app-rail-account-name">
          {busy ? "Signing in…" : "Sign in with GitHub"}
        </span>
        <span className="app-rail-account-plan">
          {available ? "Connect your GitHub account" : "Desktop app only"}
        </span>
      </span>
    </button>
  );
}

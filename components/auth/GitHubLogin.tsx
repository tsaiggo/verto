"use client";

// Desktop-only "Sign in with GitHub" control for the top bar.
//
// Mirrors UpdateCheck: it mounts in the shared shell but renders nothing in
// the web build, so the browser bundle is unaffected. When signed in it shows
// the account avatar + a sign-out menu; when signed out it kicks off the
// device flow and shows the user code via a toast.

import { useState } from "react";
import { Github, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export default function GitHubLogin() {
  const { available, loading, user, signIn, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  // Desktop-only — render nothing in the browser build or before hydration.
  if (!available || loading) return null;

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

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onSignIn}
        disabled={busy}
        aria-label="Sign in with GitHub"
        title="Sign in with GitHub"
      >
        <Github className="h-4 w-4" />
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Signed in as ${user.login}`}
          title={`Signed in as ${user.login}`}
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-5 w-5 rounded-full"
            />
          ) : (
            <Github className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {user.name ?? user.login}
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

"use client";

// Live "connect to GitHub repo" panel — desktop only.
//
// Rendered inside ConnectSourceView once the user has signed in through the
// desktop GitHub login. Unlike the presentational form (which reflects
// build-time env vars), this panel is fully interactive: it lists the
// repositories the signed-in account can read, lets the user pick a branch and
// a content path, verifies that path against the live repo, and persists the
// chosen connection to the host auth file via the auth context.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, GitBranch, Github, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { tauriFetch } from "@/lib/tauri";
import {
  listBranches,
  listRepos,
  validateContentPath,
  type GitHubRepo,
} from "@/lib/auth/github-api";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";

/** Strip surrounding slashes so "/docs/" and "docs" compare equal. */
function cleanPath(raw: string): string {
  return raw.trim().replace(/^\/+|\/+$/g, "");
}

export default function GitHubConnectPanel() {
  const { token, connection, setConnection } = useAuth();

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repo, setRepo] = useState(connection?.repo ?? "");
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branch, setBranch] = useState(connection?.branch ?? "");
  const [path, setPath] = useState(connection?.path ?? "");
  const [saving, setSaving] = useState(false);

  // Load the account's repositories on mount.
  const loadRepos = useCallback(async () => {
    if (!token) return;
    setLoadingRepos(true);
    try {
      const fetchImpl = await tauriFetch();
      const list = await listRepos(token, fetchImpl);
      setRepos(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not load repositories: ${message}`);
    } finally {
      setLoadingRepos(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  // Load branches whenever the selected repository changes.
  useEffect(() => {
    if (!token || !repo) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    setLoadingBranches(true);
    void (async () => {
      try {
        const fetchImpl = await tauriFetch();
        const list = await listBranches(token, repo, fetchImpl);
        if (cancelled) return;
        setBranches(list);
        // Default the branch to the repo's default when not already chosen.
        setBranch((current) => {
          if (current && list.includes(current)) return current;
          const meta = repos.find((r) => r.fullName === repo);
          return meta?.defaultBranch ?? list[0] ?? "";
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Could not load branches: ${message}`);
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, repo, repos]);

  const canSave = Boolean(token && repo && branch) && !saving;

  const isConnected = useMemo(
    () =>
      connection?.repo === repo &&
      connection?.branch === branch &&
      cleanPath(connection?.path ?? "") === cleanPath(path),
    [connection, repo, branch, path]
  );

  async function onSave() {
    if (!token || !repo || !branch) return;
    setSaving(true);
    try {
      const fetchImpl = await tauriFetch();
      const ok = await validateContentPath(token, repo, branch, path, fetchImpl);
      if (!ok) {
        toast.error(`Path "/${cleanPath(path)}" was not found in ${repo}@${branch}.`);
        return;
      }
      await setConnection({ repo, branch, path: cleanPath(path) });
      toast.success(`Connected to ${repo}@${branch}.`, {
        description: "Connection verified and saved to this device.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Connect failed: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="connect-form" aria-label="GitHub repository connection">
      <h2 className="connect-form-title">
        <Github className="h-4 w-4" aria-hidden /> GitHub repository
      </h2>

      <div className="connect-field">
        <label className="connect-field-label" htmlFor="gh-repo">
          Repository
        </label>
        <div className="connect-field-control">
          <div className="connect-input-wrap">
            <select
              id="gh-repo"
              className="connect-input"
              value={repo}
              disabled={loadingRepos}
              onChange={(e) => {
                setRepo(e.target.value);
                setBranch("");
              }}
            >
              <option value="">
                {loadingRepos ? "Loading repositories…" : "Select a repository"}
              </option>
              {repos.map((r) => (
                <option key={r.fullName} value={r.fullName}>
                  {r.fullName}
                  {r.private ? " (private)" : ""}
                </option>
              ))}
            </select>
          </div>
          <p className="connect-field-help">
            Repositories the signed-in account can read.
            <button
              type="button"
              className="connect-panel-refresh"
              aria-label="Reload repositories"
              onClick={() => void loadRepos()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </p>
        </div>
      </div>

      <div className="connect-field">
        <label className="connect-field-label" htmlFor="gh-branch">
          Branch
        </label>
        <div className="connect-field-control">
          <div className="connect-input-wrap">
            <select
              id="gh-branch"
              className="connect-input"
              value={branch}
              disabled={!repo || loadingBranches}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">{loadingBranches ? "Loading branches…" : "Select a branch"}</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <p className="connect-field-help">
            <GitBranch className="connect-preview-icon" aria-hidden /> Branch to read content from.
          </p>
        </div>
      </div>

      <div className="connect-field">
        <label className="connect-field-label" htmlFor="gh-path">
          Content path
        </label>
        <div className="connect-field-control">
          <div className="connect-input-wrap">
            <input
              id="gh-path"
              className="connect-input"
              value={path}
              placeholder="content"
              spellCheck={false}
              onChange={(e) => setPath(e.target.value)}
            />
          </div>
          <p className="connect-field-help">
            Sub-folder in the repo where your MDX content lives. Leave empty for the repository
            root.
          </p>
        </div>
      </div>

      <div className="connect-form-actions">
        <Button type="button" onClick={onSave} disabled={!canSave}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Check className="h-4 w-4" aria-hidden />
          )}
          {saving ? "Verifying…" : "Save & connect"}
        </Button>
        {isConnected && !saving && (
          <span className="connect-form-status">
            <span className="connect-dot" aria-hidden />
            Connection successful
          </span>
        )}
      </div>
    </section>
  );
}

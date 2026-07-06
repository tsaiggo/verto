import { GitBranch, RefreshCw } from "lucide-react";
import type { GitHubRepo } from "@/lib/auth/github-api";

interface RepoFieldProps {
  repo: string;
  repos: GitHubRepo[];
  loadingRepos: boolean;
  setRepo: (val: string) => void;
  setBranch: (val: string) => void;
  loadRepos: () => Promise<void>;
}

export function RepoField({
  repo,
  repos,
  loadingRepos,
  setRepo,
  setBranch,
  loadRepos,
}: RepoFieldProps) {
  return (
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
  );
}

interface BranchFieldProps {
  repo: string;
  branch: string;
  branches: string[];
  loadingBranches: boolean;
  setBranch: (val: string) => void;
}

export function BranchField({
  repo,
  branch,
  branches,
  loadingBranches,
  setBranch,
}: BranchFieldProps) {
  return (
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
  );
}

interface PathFieldProps {
  path: string;
  setPath: (val: string) => void;
}

export function PathField({ path, setPath }: PathFieldProps) {
  return (
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
          Sub-folder in the repo where your MDX content lives. Leave empty for the repository root.
        </p>
      </div>
    </div>
  );
}

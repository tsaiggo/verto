"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Copy, Plus, X } from "lucide-react";
import {
  agentAccessAvailable,
  agentAccessClientConfig,
  createAgentAccessGrant,
  describeAgentAccessScope,
  getAgentAccessManifestInfo,
  listAgentAccessGrants,
  revokeAgentAccessGrant,
  type AgentAccessGrant,
  type AgentAccessManifestInfo,
  type CreatedAgentAccessGrant,
} from "@/lib/agent-access";
import { listBrowserArticles, type BrowserArticle } from "@/lib/browser-articles";
import { Card } from "./settings-shared";
import styles from "./AgentAccessPanel.module.css";

interface AccessState {
  info: AgentAccessManifestInfo;
  grants: AgentAccessGrant[];
  articles: BrowserArticle[];
}

export default function AgentAccessPanel() {
  const [desktop, setDesktop] = useState(false);
  const [state, setState] = useState<AccessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"library" | "selected">("library");
  const [selected, setSelected] = useState<string[]>([]);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [includeVault, setIncludeVault] = useState(false);
  const [includeAnnotations, setIncludeAnnotations] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedAgentAccessGrant | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const available = agentAccessAvailable();
    setDesktop(available);
    if (!available) return;
    let cancelled = false;
    void Promise.all([
      getAgentAccessManifestInfo(),
      listAgentAccessGrants(),
      listBrowserArticles(),
    ]).then(
      ([info, grants, articles]) => {
        if (!cancelled) {
          setState({ info, grants, articles });
          setError(null);
        }
      },
      () => {
        if (!cancelled) setError("Couldn’t load Agent access. Retry to restore your client list.");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [retry]);

  async function addClient(event: FormEvent) {
    event.preventDefault();
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const grant = await createAgentAccessGrant({
        name,
        ...(scope === "selected" ? { documentIds: selected.map((id) => `managed:${id}`) } : {}),
        includeDrafts,
        scopes: includeAnnotations ? ["documents:read", "annotations:read"] : ["documents:read"],
        ...(scope === "library" && includeVault && state.info.availableVaultRoot
          ? { vaultRoot: state.info.availableVaultRoot }
          : {}),
      });
      setState((current) => current && { ...current, grants: [...current.grants, grant.grant] });
      setCreated(grant);
      setCopied(false);
      setAdding(false);
      setName("");
      setSelected([]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t authorize this client.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await revokeAgentAccessGrant(id);
      setState(
        (current) =>
          current && { ...current, grants: current.grants.filter((grant) => grant.id !== id) }
      );
      if (created?.grant.id === id) setCreated(null);
    } catch {
      setError("Couldn’t revoke this client. Its access is unchanged; try again.");
    } finally {
      setBusy(false);
    }
  }

  const visibleArticles =
    state?.articles.filter((article) => includeDrafts || article.status === "saved") ?? [];
  const configuration = created && created.serverPath ? agentAccessClientConfig(created) : null;

  return (
    <div className={styles.panel}>
      <Card
        title="Agent access"
        description="Let a named external AI client search and read the documents you choose. Access is read-only and can be revoked here."
      >
        {!desktop ? (
          <p className={styles.description}>
            External Agent connections are available in the Verto desktop app. Browser documents
            stay in this browser; no external access is enabled here.
          </p>
        ) : (
          <>
            <p className={styles.description}>
              Your client may send retrieved passages and annotations to its configured AI provider.
              Choose the content you want that client to access.
            </p>
            {error ? (
              <p role="alert" className={styles.error}>
                {error}
                {!state ? (
                  <button
                    type="button"
                    className="v-btn v-btn--sm"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Retry
                  </button>
                ) : null}
              </p>
            ) : null}
            {!state && !error ? (
              <p role="status" className={styles.description}>
                Loading authorized clients…
              </p>
            ) : null}
            {state ? (
              <>
                <div className={styles.clients}>
                  {state.grants.length === 0 ? (
                    <p className={styles.description}>No external clients have access.</p>
                  ) : (
                    state.grants.map((grant) => (
                      <div key={grant.id} className={styles.client}>
                        <div>
                          <strong>{grant.name}</strong>
                          <small>{describeAgentAccessScope(grant)}</small>
                        </div>
                        <button
                          type="button"
                          className="v-btn v-btn--sm"
                          disabled={busy}
                          onClick={() => void revoke(grant.id)}
                          aria-label={`Revoke ${grant.name}`}
                        >
                          Revoke
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {created ? (
                  <section className={styles.configuration} aria-label="New client connection">
                    <div className={styles.configurationHeader}>
                      <strong>Connect {created.grant.name}</strong>
                      <button
                        type="button"
                        className="v-btn v-btn--sm"
                        aria-label="Dismiss client credentials"
                        onClick={() => setCreated(null)}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                    <p className={styles.description}>
                      Copy this connection now. The access token is shown only once. Keep it with
                      the client that you authorized. The local MCP companion requires Node.js 20.19
                      or later.
                    </p>
                    {created.grant.annotationRoot ? (
                      <p className={styles.path}>
                        Annotation workspace: {created.grant.annotationRoot}
                      </p>
                    ) : null}
                    {configuration ? (
                      <>
                        <pre tabIndex={0} aria-label="MCP client configuration">
                          {configuration}
                        </pre>
                        <button
                          type="button"
                          className="v-btn v-btn--sm"
                          onClick={() => {
                            void navigator.clipboard.writeText(configuration).then(
                              () => setCopied(true),
                              () =>
                                setError(
                                  "Couldn’t copy the configuration. Select and copy it from the field."
                                )
                            );
                          }}
                        >
                          <Copy size={14} aria-hidden />
                          {copied ? "Copied" : "Copy MCP configuration"}
                        </button>
                      </>
                    ) : (
                      <>
                        <label className={styles.field}>
                          Access token
                          <input
                            readOnly
                            value={created.token}
                            aria-label="Client access token"
                            onFocus={(event) => event.target.select()}
                          />
                        </label>
                        <p className={styles.description}>
                          The MCP companion is unavailable in this build. Use the documented source
                          command with this token and manifest:
                        </p>
                        <code className={styles.path}>{created.manifestPath}</code>
                      </>
                    )}
                  </section>
                ) : null}
                {adding ? (
                  <form className={styles.form} onSubmit={(event) => void addClient(event)}>
                    <label className={styles.field}>
                      Client name
                      <input
                        required
                        maxLength={80}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="For example, Codex on this computer"
                      />
                    </label>
                    <fieldset className={styles.scope}>
                      <legend>Local articles</legend>
                      <label>
                        <input
                          type="radio"
                          name="agent-access-scope"
                          checked={scope === "library"}
                          onChange={() => setScope("library")}
                        />
                        Saved local Library
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="agent-access-scope"
                          checked={scope === "selected"}
                          onChange={() => {
                            setScope("selected");
                            setIncludeVault(false);
                          }}
                        />
                        Selected local documents
                      </label>
                    </fieldset>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={includeDrafts}
                        onChange={(event) => {
                          setIncludeDrafts(event.target.checked);
                          if (!event.target.checked)
                            setSelected((ids) =>
                              ids.filter((id) =>
                                state.articles.some(
                                  (article) => article.id === id && article.status === "saved"
                                )
                              )
                            );
                        }}
                      />
                      Include saved drafts
                    </label>
                    {scope === "selected" ? (
                      <fieldset className={styles.documents}>
                        <legend>Select documents</legend>
                        {visibleArticles.length ? (
                          visibleArticles.map((article) => (
                            <label key={article.id}>
                              <input
                                type="checkbox"
                                checked={selected.includes(article.id)}
                                onChange={(event) =>
                                  setSelected((ids) =>
                                    event.target.checked
                                      ? [...ids, article.id]
                                      : ids.filter((id) => id !== article.id)
                                  )
                                }
                              />
                              <span>
                                {article.title || article.filename}
                                {article.status === "draft" ? " · Draft" : ""}
                              </span>
                            </label>
                          ))
                        ) : (
                          <p className={styles.description}>
                            No matching local articles. Save an article in Library first.
                          </p>
                        )}
                      </fieldset>
                    ) : null}
                    {scope === "library" && state.info.availableVaultRoot ? (
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          checked={includeVault}
                          onChange={(event) => setIncludeVault(event.target.checked)}
                        />
                        <span>
                          Also include the connected Markdown folder
                          <small className={styles.path}>{state.info.availableVaultRoot}</small>
                        </span>
                      </label>
                    ) : null}
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={includeAnnotations}
                        onChange={(event) => setIncludeAnnotations(event.target.checked)}
                      />
                      Include annotations from the current workspace
                    </label>
                    <p className={styles.description}>
                      Only annotations attached to authorized documents are shared. Folder
                      annotations stay tied to the workspace used when this client is authorized.
                    </p>
                    <p className={styles.description}>
                      PDF and EPUB files, unsaved edits, and unconnected sources are outside this
                      access scope.
                    </p>
                    <div className={styles.actions}>
                      <button
                        type="submit"
                        className="v-btn v-btn--sm"
                        disabled={
                          busy || !name.trim() || (scope === "selected" && selected.length === 0)
                        }
                      >
                        {busy ? "Authorizing…" : "Authorize client"}
                      </button>
                      <button
                        type="button"
                        className="v-btn v-btn--sm"
                        disabled={busy}
                        onClick={() => setAdding(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="v-btn v-btn--sm"
                    disabled={busy}
                    onClick={() => {
                      setCreated(null);
                      setAdding(true);
                    }}
                  >
                    <Plus size={14} aria-hidden />
                    Authorize a client
                  </button>
                )}
              </>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearWebKey, loadWebKey, saveWebKey } from "@/lib/ai/key-store";
import { getAssistantConfig } from "@/lib/ai";
import styles from "./AssistantConnectPanel.module.css";

export default function AssistantConnectPanel() {
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const config = useMemo(() => getAssistantConfig(), []);

  useEffect(() => {
    const sync = () => setKey(loadWebKey());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  if (config.kind === "none") {
    return (
      <section className={styles.notice} aria-label="Assistant unavailable" role="status">
        <CircleAlert aria-hidden />
        <div>
          <strong>No assistant provider is included in this build.</strong>
          <p>Agent remains available for local thread history, but it cannot send AI requests.</p>
        </div>
      </section>
    );
  }

  if (config.kind === "mock") {
    return (
      <section className={styles.notice} aria-label="Development assistant" role="status">
        <Sparkles aria-hidden />
        <div>
          <strong>Local mock provider</strong>
          <p>
            This development provider returns local sample replies and does not use a credential.
          </p>
        </div>
      </section>
    );
  }

  function saveCredential() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!saveWebKey(trimmed)) {
      toast.error("Could not save the assistant credential", {
        description: "Local browser storage is unavailable. Your key has not been changed.",
      });
      return;
    }
    setDraft("");
    toast.success("Assistant credential saved", {
      description: "GitHub Models will verify it when you make the next request.",
    });
  }

  function removeCredential() {
    if (!clearWebKey()) {
      toast.error("Could not remove the assistant credential", {
        description: "Local browser storage is unavailable. The saved key is unchanged.",
      });
      return;
    }
    setDraft("");
    toast.success("Assistant credential removed");
  }

  return (
    <div className={styles.panel}>
      <dl className={styles.providerMeta}>
        <div>
          <dt>Provider</dt>
          <dd>GitHub Models</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>
            <code title={config.model}>{config.model}</code>
          </dd>
        </div>
        <div>
          <dt>Credential</dt>
          <dd>{key ? "Saved on this device" : "Not saved"}</dd>
        </div>
      </dl>

      <div className={styles.form}>
        <label htmlFor="assistant-key">Assistant access key</label>
        <div className={styles.inputRow}>
          <input
            id="assistant-key"
            type="password"
            placeholder={key ? "Replace saved credential" : "Paste a GitHub Models token"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-describedby="assistant-key-help"
          />
          <Button type="button" size="sm" onClick={saveCredential} disabled={!draft.trim()}>
            <Sparkles aria-hidden />
            {key ? "Replace key" : "Save key"}
          </Button>
        </div>
        <p id="assistant-key-help">
          Stored only on this device. Verto sends it to GitHub Models only when you make an
          assistant request.
        </p>
        {key ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.removeButton}
            onClick={removeCredential}
          >
            Remove saved key
          </Button>
        ) : null}
      </div>
    </div>
  );
}

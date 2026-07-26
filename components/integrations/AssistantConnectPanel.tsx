"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { clearWebKey, loadWebKey, saveWebKey } from "@/lib/ai/key-store";
import { getAssistantConfig } from "@/lib/ai";
import styles from "./AssistantConnectPanel.module.css";

export default function AssistantConnectPanel() {
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const sync = () => setKey(loadWebKey());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const config = getAssistantConfig();

  if (!config.enabled) {
    return (
      <section className={styles.panel} aria-label="AI setup status">
        <div className={styles.status} role="status">
          <CircleAlert className={styles.statusIcon} aria-hidden />
          <div className={styles.statusCopy}>
            <strong>No AI provider is included in this build</strong>
            <p>
              Reading, search, and editing still work locally. AI can be added later without moving
              your files or uploading the library to Verto.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (config.kind === "mock") {
    return (
      <section className={styles.panel} aria-label="AI setup status">
        <div className={styles.status} role="status">
          <CircleCheck className={`${styles.statusIcon} ${styles.saved}`} aria-hidden />
          <div className={styles.statusCopy}>
            <strong>Local demo provider is ready</strong>
            <p>This development provider does not send requests or require an access key.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.status} role="status" aria-live="polite">
        {key ? (
          <CircleCheck className={`${styles.statusIcon} ${styles.saved}`} aria-hidden />
        ) : (
          <CircleAlert className={styles.statusIcon} aria-hidden />
        )}
        <div className={styles.statusCopy}>
          <strong>{key ? "GitHub Models is ready" : "GitHub Models needs an access key"}</strong>
          <p>
            {key
              ? "The key is stored on this device and is used only after you ask the Agent."
              : "Add a GitHub token to enable grounded answers and approval-based Agent actions."}
          </p>
        </div>
      </div>

      <label className={styles.keyForm} htmlFor="assistant-key">
        <span className={styles.label}>Provider access key</span>
        <input
          id="assistant-key"
          type="password"
          className={styles.input}
          placeholder={key ? "Saved locally" : "Paste the token for your configured model"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <p className={styles.help}>
        Saved only on this device. When you ask, Verto sends the key for authorization, your
        question, and either the current document or source titles and relevant excerpts to GitHub
        Models.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className="v-btn v-btn--sm"
          onClick={() => {
            saveWebKey(draft);
            setDraft("");
            toast.success("Provider key saved on this device");
          }}
          disabled={!draft.trim()}
        >
          <Sparkles aria-hidden />
          Save key
        </button>
        {key ? (
          <button
            type="button"
            className="v-btn v-btn--sm"
            onClick={() => {
              clearWebKey();
              toast("Provider key removed");
            }}
          >
            Remove key
          </button>
        ) : null}
      </div>
    </div>
  );
}

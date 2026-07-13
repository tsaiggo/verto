"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Sparkles } from "lucide-react";
import { clearWebKey, loadWebKey, saveWebKey } from "@/lib/ai/key-store";
import { getAssistantConfig } from "@/lib/ai";

export default function AssistantConnectPanel() {
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const sync = () => setKey(loadWebKey());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const enabled = getAssistantConfig().enabled;

  if (!enabled) {
    return (
      <section className="set-ai-unavailable" aria-label="AI setup required" role="status">
        <div className="set-ai-unavailable-head">
          <CircleAlert aria-hidden />
          <div>
            <strong>AI is not enabled in this version of Verto.</strong>
            <p>
              Turn on the GitHub Models provider first. Once Verto includes it, you can return here
              to save an access key on this device.
            </p>
          </div>
        </div>
        <ol className="set-ai-unavailable-steps">
          <li>
            Set <code>NEXT_PUBLIC_VERTO_ASSISTANT=github</code> in the environment used to build
            Verto.
          </li>
          <li>Restart your development app or build a new Verto release.</li>
          <li>Return here to save your GitHub Models access key.</li>
        </ol>
      </section>
    );
  }

  return (
    <div className="set-ai-key">
      <label className="set-field" htmlFor="assistant-key">
        <span className="set-field-label">Assistant access key</span>
        <input
          id="assistant-key"
          type="password"
          className="set-input"
          placeholder={key ? "Saved locally" : "Paste the token for your configured model"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
        />
      </label>
      <p className="set-ai-key-help">
        Stored only on this device and sent only to the configured inference endpoint.
      </p>
      <div className="set-ai-key-actions">
        <button
          type="button"
          className="v-btn v-btn--sm"
          onClick={() => {
            saveWebKey(draft);
            setDraft("");
          }}
          disabled={!draft.trim()}
        >
          <Sparkles aria-hidden />
          Save key
        </button>
        {key ? (
          <button type="button" className="v-btn v-btn--sm" onClick={() => clearWebKey()}>
            Remove key
          </button>
        ) : null}
      </div>
    </div>
  );
}

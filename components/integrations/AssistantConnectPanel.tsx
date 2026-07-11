"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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
      <p className="set-ai-key-help">
        The assistant is off. Set <code>NEXT_PUBLIC_VERTO_ASSISTANT=github</code> to enable it.
      </p>
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

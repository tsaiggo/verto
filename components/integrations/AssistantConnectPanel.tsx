"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { clearWebKey, loadWebKey, saveWebKey } from "@/lib/ai/key-store";
import { getAssistantConfig } from "@/lib/ai";
import { Button } from "@/components/ui/button";

export default function AssistantConnectPanel() {
  const { available: desktop, user } = useAuth();
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const sync = () => setKey(loadWebKey());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const enabled = getAssistantConfig().enabled;
  const connected = desktop ? Boolean(user) : Boolean(key);

  return (
    <section className="connect-panel connect-panel-accent" aria-label="AI assistant">
      <div className="connect-panel-head">
        <h2 className="connect-panel-title">AI assistant</h2>
        <span className={`connect-badge${connected ? " is-connected" : " is-idle"}`}>
          <span className="connect-dot" aria-hidden />
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {!enabled ? (
        <p className="connect-field-help">
          The reading companion is off. Set <code>NEXT_PUBLIC_VERTO_ASSISTANT=github</code> to
          enable it.
        </p>
      ) : desktop ? (
        <p className="connect-field-help">
          The desktop app reuses your GitHub sign-in for the assistant. Sign in from the top bar.
        </p>
      ) : (
        <div className="connect-field">
          <label className="connect-field-label" htmlFor="assistant-key">
            GitHub Models token
          </label>
          <div className="connect-field-control">
            <input
              id="assistant-key"
              type="password"
              className="connect-input"
              placeholder={key ? "•••••••• saved" : "github_pat_… or ghp_…"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
            />
            <p className="connect-field-help">
              Stored only in this browser; sent only to the inference endpoint.
            </p>
          </div>
          <div className="connect-form-actions">
            <Button
              type="button"
              onClick={() => {
                saveWebKey(draft);
                setDraft("");
              }}
              disabled={!draft.trim()}
            >
              <Sparkles className="h-4 w-4" aria-hidden /> Save key
            </Button>
            {key && (
              <Button type="button" variant="outline" onClick={() => clearWebKey()}>
                Disconnect
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

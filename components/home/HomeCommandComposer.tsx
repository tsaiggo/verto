"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowUp,
  Circle,
  HardDrive,
  MessageSquareText,
  Mic,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";

interface VoiceRecognitionEvent {
  results: ArrayLike<{ 0?: { transcript?: string } }>;
}

interface VoiceRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;

function voiceRecognitionConstructor(): VoiceRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = window as unknown as {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

function subscribeVoiceSupport(): () => void {
  return () => {};
}

function voiceSupportSnapshot(): boolean {
  return voiceRecognitionConstructor() !== null;
}

export default function HomeCommandComposer({
  sourceLabel,
  statusLabel = "Library ready",
}: {
  sourceLabel: string;
  statusLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const voiceSupported = useSyncExternalStore(
    subscribeVoiceSupport,
    voiceSupportSnapshot,
    () => false
  );
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // The recognition session may already have closed.
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        recognitionRef.current = null;
        setListening(false);
        setVoiceError("Voice input could not be stopped. Try again.");
      }
      return;
    }

    const Recognition = voiceRecognitionConstructor();
    if (!Recognition) return;
    setVoiceError("");
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript || !inputRef.current) return;
      inputRef.current.value = transcript;
      inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      inputRef.current.focus();
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError("Voice input stopped unexpectedly. Try again.");
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError("Voice input could not be started. Check browser permissions and try again.");
    }
  };

  return (
    <section className="codex-home-composer" aria-labelledby="codex-home-composer-title">
      <div className="codex-home-run-status" role="status">
        <Circle className="codex-home-run-indicator" aria-hidden />
        <span>{statusLabel}</span>
      </div>
      <h2 id="codex-home-composer-title" className="sr-only">
        Search or ask your workspace
      </h2>
      <form className="codex-home-search" action="/search" method="get" role="search">
        <label className="sr-only" htmlFor="codex-home-search-input">
          Search your workspace
        </label>
        <input
          ref={inputRef}
          id="codex-home-search-input"
          className="codex-home-search-input"
          type="search"
          name="q"
          placeholder="Search your workspace"
          autoComplete="off"
          enterKeyHint="search"
        />

        <div className="codex-home-composer-footer">
          <div className="codex-home-composer-actions">
            <Link
              href="/integrations"
              className="codex-home-source-link is-icon"
              aria-label="Add or manage content sources"
            >
              <Plus aria-hidden />
            </Link>
            <Link
              href="/integrations"
              className="codex-home-ask-link"
              aria-label="Review source access"
            >
              <ShieldCheck aria-hidden />
              <span>Source access</span>
            </Link>
          </div>

          <div className="codex-home-composer-tools">
            <span className="codex-home-source-name" title={sourceLabel}>
              <HardDrive aria-hidden />
              {sourceLabel}
            </span>
            <Link href="/agent" className="codex-home-model-link">
              <MessageSquareText aria-hidden />
              <span>Verto Agent</span>
            </Link>
            <button
              type="button"
              className={`codex-home-mic${listening ? " is-listening" : ""}`}
              aria-label={
                !voiceSupported
                  ? "Voice input not supported"
                  : listening
                    ? "Stop voice input"
                    : "Start voice input"
              }
              aria-pressed={voiceSupported ? listening : undefined}
              disabled={!voiceSupported}
              onClick={toggleVoiceInput}
            >
              <Mic aria-hidden />
            </button>
            {voiceError ? (
              <span className="sr-only" role="alert">
                {voiceError}
              </span>
            ) : null}
            <button type="submit" className="codex-home-submit" aria-label="Search workspace">
              <Search className="codex-home-submit-search" aria-hidden />
              <ArrowUp className="codex-home-submit-arrow" aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

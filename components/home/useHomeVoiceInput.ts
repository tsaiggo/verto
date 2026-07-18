"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { toast } from "sonner";

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

function reportVoiceError(setVoiceError: (message: string) => void, message: string) {
  setVoiceError(message);
  toast.error("Voice input unavailable", { description: message });
}

export function useHomeVoiceInput(
  inputRef: RefObject<HTMLInputElement | null>,
  setQuery: (query: string) => void
) {
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

  function toggleVoiceInput() {
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        recognitionRef.current = null;
        setListening(false);
        reportVoiceError(setVoiceError, "Voice input could not be stopped. Try again.");
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
      if (!transcript) return;
      setQuery(transcript);
      inputRef.current?.focus();
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
      reportVoiceError(setVoiceError, "Voice input stopped unexpectedly. Try again.");
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      reportVoiceError(
        setVoiceError,
        "Voice input could not be started. Check browser permissions and try again."
      );
    }
  }

  return { voiceSupported, listening, voiceError, toggleVoiceInput };
}

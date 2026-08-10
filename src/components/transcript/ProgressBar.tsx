"use client";

import { useEffect, useRef, useState } from "react";
import type { SSEEvent } from "@/types/transcript";

interface Props {
  transcriptId: string;
  onDone: () => void;
  onError: (msg: string) => void;
}

export default function ProgressBar({ transcriptId, onDone, onError }: Props) {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("Starting…");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/transcripts/${transcriptId}/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        if ("done" in event) {
          setProgress(100);
          setStep("Ready for review");
          es.close();
          onDone();
        } else if ("error" in event) {
          es.close();
          onError(event.error);
        } else if ("progress" in event) {
          setProgress(event.progress);
          setStep(event.step);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      onError("Connection lost. Refresh and check transcript history.");
    };

    return () => es.close();
  }, [transcriptId, onDone, onError]);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{step}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

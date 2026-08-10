"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptMode } from "@/types/transcript";

interface Props {
  mode: TranscriptMode;
  catalogId?: string;
  onCreated: (transcriptId: string) => void;
}

const ACCEPTED_EXTS = ".txt,.docx,.vtt";

export default function TranscriptUpload({ mode, catalogId, onCreated }: Props) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextPrompt, setContextPrompt] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "new_diagram") {
      fetch("/api/catalogs/templates")
        .then((r) => r.json())
        .then((d) => setTemplates((d.templates ?? []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))))
        .catch(() => {});
    }
  }, [mode]);

  async function handleFile(file: File) {
    setFileName(file.name);
    // .txt and .vtt we can preview inline; .docx goes to server
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "txt" || ext === "vtt") {
      setText(await file.text());
    } else {
      setText(""); // docx bytes sent as multipart
    }
  }

  async function submit() {
    setError(null);
    if (!title.trim()) { setError("Meeting title is required"); return; }

    setSubmitting(true);
    try {
      const file = fileRef.current?.files?.[0];
      const ext = file?.name.split(".").pop()?.toLowerCase();

      let body: BodyInit;
      let headers: Record<string, string> = {};

      if (file && ext === "docx") {
        const form = new FormData();
        form.append("mode", mode);
        form.append("title", title);
        form.append("meetingDate", meetingDate);
        if (catalogId) form.append("catalogId", catalogId);
        if (contextPrompt.trim()) form.append("contextPrompt", contextPrompt.trim());
        if (templateId) form.append("templateId", templateId);
        form.append("file", file);
        body = form;
      } else {
        const payload = text.trim();
        if (!payload) { setError("Paste your transcript or upload a file"); setSubmitting(false); return; }
        body = JSON.stringify({ mode, title, meetingDate, catalogId, text: payload,
          contextPrompt: contextPrompt.trim() || undefined,
          templateId: templateId || undefined,
        });
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch("/api/transcripts", { method: "POST", headers, body });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
      onCreated(data.id);
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Template picker — only for new_diagram mode */}
      {mode === "new_diagram" && templates.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Start from template (optional)</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          >
            <option value="">Blank — generate from scratch</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* File drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors
          ${dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400 hover:bg-slate-50"}`}
      >
        <svg className="mb-2 h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.28 3.75 3.75 0 0 1 4.068 5.055H18.75A2.25 2.25 0 0 0 16.5 16.5H7.5Z" />
        </svg>
        <span className="text-slate-600">
          {fileName ? `File: ${fileName}` : "Drop a .txt, .docx, or .vtt file, or click to browse"}
        </span>
        <span className="mt-1 text-xs text-slate-400">or paste transcript below</span>
        <input ref={fileRef} type="file" accept={ACCEPTED_EXTS} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {/* Paste box */}
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setFileName(null); }}
        placeholder="Paste meeting transcript here…"
        rows={8}
        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
      />

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Meeting title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 Capability Review"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Meeting date</label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {/* Context & specifications */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Context & specifications (optional)</label>
        <textarea
          value={contextPrompt}
          onChange={(e) => setContextPrompt(e.target.value)}
          placeholder={`e.g. "Sarah is from our team, John is the client. When John says 'we have X', mark it green."`}
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
        />
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Uploading…" : "Analyse Transcript"}
      </button>
    </div>
  );
}

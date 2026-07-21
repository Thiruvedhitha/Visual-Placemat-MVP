# Meeting Transcript → Capability Map: Full Implementation Plan

## Overview

Upload a meeting transcript (text paste or .txt file) → AI extracts capability changes & category assignments → User reviews with multi-select validation → Approved changes applied in batch with progress tracking.

**Input:** Text only (paste from Teams/Zoom/Google Meet transcript export, or upload .txt file).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        TRANSCRIPT PIPELINE                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Upload] → [Clean] → [Extract] → [Resolve] → [Review UI] → [Apply] │
│     │          │          │           │             │            │     │
│  Progress:   Step 1     Step 2      Step 3       Step 4       Step 5  │
│   10%         30%        60%         80%          90%         100%    │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- Migration: transcript_processing.sql

-- Store uploaded transcripts
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id    uuid REFERENCES capability_catalogs(id) ON DELETE SET NULL,
  user_id       uuid NOT NULL,
  title         text,
  raw_text      text NOT NULL,
  cleaned_text  text,
  status        text NOT NULL DEFAULT 'uploaded',
  -- Status flow: uploaded → cleaning → extracting → resolving → ready_for_review → applying → completed | failed
  progress      int NOT NULL DEFAULT 0,  -- 0-100
  current_step  text,
  error_message text,
  created_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

-- Store AI-extracted proposed changes (structural + category)
CREATE TABLE IF NOT EXISTS proposed_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id   uuid REFERENCES meeting_transcripts(id) ON DELETE CASCADE,
  change_type     text NOT NULL,       -- 'structural' | 'category'
  
  -- For structural changes
  action          text,                -- add | remove | rename | move
  target_name     text NOT NULL,       -- capability name
  target_id       uuid,                -- resolved existing capability id (null for 'add')
  parent_name     text,
  parent_id       uuid,
  new_name        text,                -- for rename
  new_parent_id   uuid,               -- for move
  
  -- For category changes
  category        text,                -- have | need | in_progress | planned | retire
  color           text,                -- hex color to apply
  
  -- Common fields
  confidence      numeric(3,2) NOT NULL DEFAULT 0.50,
  source_quote    text,
  selected        boolean DEFAULT true,  -- user's selection state
  status          text DEFAULT 'pending', -- pending | accepted | declined | applied | failed
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_proposed_changes_transcript ON proposed_changes(transcript_id);
CREATE INDEX idx_meeting_transcripts_user ON meeting_transcripts(user_id);
```

---

## API Routes

### 1. POST `/api/transcripts` — Upload & Start Processing

**File:** `src/app/api/transcripts/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, title, catalogId } = await req.json();

  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: "Transcript too short" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Create transcript record
  const { data: transcript, error } = await supabase
    .from("meeting_transcripts")
    .insert({
      user_id: user.id,
      title: title || "Untitled Meeting",
      raw_text: text,
      catalog_id: catalogId || null,
      status: "uploaded",
      progress: 0,
      current_step: "Uploaded",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Kick off async processing (non-blocking)
  void processTranscript(transcript.id, text, catalogId);

  return NextResponse.json({ transcriptId: transcript.id });
}
```

### 2. GET `/api/transcripts/[id]` — Poll Status & Get Changes

**File:** `src/app/api/transcripts/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data: transcript } = await supabase
    .from("meeting_transcripts")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!transcript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If ready for review, fetch proposed changes
  let changes: any[] = [];
  if (["ready_for_review", "applying", "completed"].includes(transcript.status)) {
    const { data } = await supabase
      .from("proposed_changes")
      .select("*")
      .eq("transcript_id", params.id)
      .order("sort_order", { ascending: true });
    changes = data || [];
  }

  return NextResponse.json({ transcript, changes });
}
```

### 3. PATCH `/api/transcripts/[id]/changes` — Update Selection State

**File:** `src/app/api/transcripts/[id]/changes/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { selections } = await req.json();
  // selections: Array<{ id: string; selected: boolean }>

  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: transcript } = await supabase
    .from("meeting_transcripts")
    .select("user_id")
    .eq("id", params.id)
    .single();

  if (!transcript || transcript.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Batch update selections
  for (const sel of selections) {
    await supabase
      .from("proposed_changes")
      .update({ selected: sel.selected, status: sel.selected ? "accepted" : "declined" })
      .eq("id", sel.id)
      .eq("transcript_id", params.id);
  }

  return NextResponse.json({ ok: true });
}
```

### 4. POST `/api/transcripts/[id]/apply` — Execute Selected Changes

**File:** `src/app/api/transcripts/[id]/apply/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { v4 as uuid } from "uuid";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Get selected changes
  const { data: changes } = await supabase
    .from("proposed_changes")
    .select("*")
    .eq("transcript_id", params.id)
    .eq("selected", true)
    .eq("status", "accepted")
    .order("sort_order");

  if (!changes || changes.length === 0) {
    return NextResponse.json({ error: "No changes selected" }, { status: 400 });
  }

  // Update transcript status
  await supabase
    .from("meeting_transcripts")
    .update({ status: "applying", progress: 90, current_step: "Applying changes" })
    .eq("id", params.id);

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const change of changes) {
    try {
      if (change.change_type === "structural") {
        await applyStructuralChange(supabase, change);
      } else if (change.change_type === "category") {
        await applyCategoryChange(supabase, change);
      }
      await supabase
        .from("proposed_changes")
        .update({ status: "applied" })
        .eq("id", change.id);
      results.push({ id: change.id, success: true });
    } catch (e: any) {
      await supabase
        .from("proposed_changes")
        .update({ status: "failed" })
        .eq("id", change.id);
      results.push({ id: change.id, success: false, error: e.message });
    }
  }

  // Mark complete
  await supabase
    .from("meeting_transcripts")
    .update({ status: "completed", progress: 100, current_step: "Done", completed_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ results });
}

// ── Apply Helpers ──

async function applyStructuralChange(supabase: any, change: any) {
  switch (change.action) {
    case "add":
      await supabase.from("capabilities").insert({
        id: uuid(),
        name: change.target_name,
        parent_id: change.parent_id || null,
        catalog_id: change.catalog_id,
        level: change.parent_id ? /* compute from parent */ 1 : 0,
        sort_order: 999,
      });
      break;
    case "remove":
      if (change.target_id) {
        await supabase.from("capabilities").delete().eq("id", change.target_id);
      }
      break;
    case "rename":
      if (change.target_id && change.new_name) {
        await supabase.from("capabilities").update({ name: change.new_name }).eq("id", change.target_id);
      }
      break;
    case "move":
      if (change.target_id && change.new_parent_id) {
        await supabase.from("capabilities").update({ parent_id: change.new_parent_id }).eq("id", change.target_id);
      }
      break;
  }
}

async function applyCategoryChange(supabase: any, change: any) {
  if (change.target_id && change.color) {
    await supabase.from("capabilities").update({ color: change.color }).eq("id", change.target_id);
  }
}
```

---

## Processing Pipeline (Server-Side)

**File:** `src/lib/transcript/processTranscript.ts`

```typescript
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

const openai = new OpenAI();

const CATEGORY_COLORS: Record<string, string> = {
  have: "#22c55e",
  need: "#ef4444",
  in_progress: "#eab308",
  planned: "#3b82f6",
  retire: "#6b7280",
};

// ── Main Pipeline ──────────────────────────────────────────────────────

export async function processTranscript(transcriptId: string, rawText: string, catalogId?: string) {
  const supabase = getSupabaseAdmin();

  try {
    // ─── Step 1: Clean Noise (10% → 30%) ───
    await updateProgress(supabase, transcriptId, 10, "cleaning", "Removing noise...");
    const cleanedText = cleanTranscript(rawText);
    await supabase.from("meeting_transcripts").update({ cleaned_text: cleanedText }).eq("id", transcriptId);
    await updateProgress(supabase, transcriptId, 30, "extracting", "Extracting capability changes...");

    // ─── Step 2: Extract Changes via AI (30% → 60%) ───
    const capabilityTree = catalogId ? await getCapabilityTree(supabase, catalogId) : "";
    const extracted = await extractChangesFromTranscript(cleanedText, capabilityTree);
    await updateProgress(supabase, transcriptId, 60, "resolving", "Resolving against existing map...");

    // ─── Step 3: Resolve Against Existing Map (60% → 80%) ───
    const resolved = catalogId
      ? await resolveAgainstMap(supabase, extracted, catalogId)
      : extracted;
    await updateProgress(supabase, transcriptId, 80, "saving", "Preparing review...");

    // ─── Step 4: Save Proposed Changes (80% → 90%) ───
    const proposedChanges = resolved.map((change, i) => ({
      transcript_id: transcriptId,
      change_type: change.change_type,
      action: change.action || null,
      target_name: change.target_name,
      target_id: change.target_id || null,
      parent_name: change.parent_name || null,
      parent_id: change.parent_id || null,
      new_name: change.new_name || null,
      new_parent_id: change.new_parent_id || null,
      category: change.category || null,
      color: change.category ? CATEGORY_COLORS[change.category] : null,
      confidence: change.confidence,
      source_quote: change.source_quote,
      selected: change.confidence >= 0.7,  // Auto-select high confidence
      sort_order: i,
    }));

    await supabase.from("proposed_changes").insert(proposedChanges);

    // ─── Step 5: Ready for Review (90%) ───
    await updateProgress(supabase, transcriptId, 90, "ready_for_review", "Ready for review");

  } catch (error: any) {
    await supabase
      .from("meeting_transcripts")
      .update({ status: "failed", error_message: error.message, current_step: "Failed" })
      .eq("id", transcriptId);
  }
}

// ── Helper: Update Progress ──

async function updateProgress(supabase: any, id: string, progress: number, status: string, step: string) {
  await supabase
    .from("meeting_transcripts")
    .update({ progress, status, current_step: step })
    .eq("id", id);
}

// ── Step 1: Clean Transcript ──

function cleanTranscript(raw: string): string {
  let text = raw;

  // Remove timestamps
  text = text.replace(/\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*/g, "");

  // Remove filler words
  text = text.replace(/\b(um|uh|uhh|hmm|you know|like|basically|actually|so yeah)\b/gi, "");

  // Remove caption artifacts
  text = text.replace(/\[(inaudible|crosstalk|laughter|pause|silence)\]/gi, "");

  // Remove meeting admin lines
  text = text.replace(/^.*\b(mute|unmute|can you hear me|screen share|sorry I'm late|you're on mute)\b.*$/gim, "");

  // Collapse whitespace
  text = text.replace(/\s{2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  // Remove very short lines (< 5 chars)
  text = text
    .split("\n")
    .filter((line) => line.trim().length >= 5)
    .join("\n");

  return text.trim();
}

// ── Step 2: AI Extraction ──

async function extractChangesFromTranscript(cleanedText: string, capabilityTree: string) {
  const systemPrompt = `You are an AI that analyzes meeting transcripts to extract two types of information about capabilities:

1. STRUCTURAL CHANGES — additions, removals, renames, moves of capabilities
2. CATEGORY ASSIGNMENTS — status/maturity of capabilities discussed

For each item, provide:
- change_type: "structural" or "category"
- For structural: action ("add"|"remove"|"rename"|"move"), target_name, parent_name (if add/move), new_name (if rename)
- For category: category ("have"|"need"|"in_progress"|"planned"|"retire"), target_name
- confidence: 0.0-1.0 (0.9+ for explicit decisions, 0.6-0.8 for implied, <0.6 for ambiguous)
- source_quote: exact verbatim quote from transcript

Category definitions:
- "have": Already implemented/in use ("we have", "already in place", "currently using")
- "need": Gap/missing ("we need", "don't have", "gap", "missing")
- "in_progress": Being built ("working on", "building", "in development")
- "planned": On roadmap, not started ("planning to", "next quarter", "will implement")
- "retire": Being removed ("phasing out", "deprecated", "sunset", "legacy")

Rules:
- Only extract EXPLICIT decisions or CLEAR implications
- Do NOT infer from hypothetical/conditional statements ("if we had...", "maybe we should...")
- Include the verbatim source quote for traceability
- If same capability is mentioned multiple times, use the FINAL/STRONGEST signal

Return ONLY a JSON array. No markdown, no explanation.`;

  const userPrompt = `${capabilityTree ? `Existing Capability Map:\n${capabilityTree}\n\n` : ""}Meeting Transcript:\n${cleanedText}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content || "[]";
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.changes || parsed.results || [];
  } catch {
    return [];
  }
}

// ── Step 3: Resolve Against Existing Map ──

async function resolveAgainstMap(supabase: any, changes: any[], catalogId: string) {
  const { data: capabilities } = await supabase
    .from("capabilities")
    .select("id, name, parent_id, level")
    .eq("catalog_id", catalogId);

  if (!capabilities) return changes;

  const capByName = new Map(
    capabilities.map((c: any) => [c.name.toLowerCase().trim(), c])
  );

  return changes.map((change) => {
    // Resolve target
    const targetKey = change.target_name?.toLowerCase().trim();
    const match = capByName.get(targetKey);
    if (match) {
      change.target_id = match.id;
    }

    // Resolve parent
    if (change.parent_name) {
      const parentKey = change.parent_name.toLowerCase().trim();
      const parentMatch = capByName.get(parentKey);
      if (parentMatch) {
        change.parent_id = parentMatch.id;
      }
    }

    return change;
  });
}

// ── Helper: Get Capability Tree as Text ──

async function getCapabilityTree(supabase: any, catalogId: string): string {
  const { data: capabilities } = await supabase
    .from("capabilities")
    .select("id, name, parent_id, level, sort_order")
    .eq("catalog_id", catalogId)
    .order("sort_order");

  if (!capabilities || capabilities.length === 0) return "";

  // Build indented tree
  const byParent = new Map<string | null, any[]>();
  for (const cap of capabilities) {
    const key = cap.parent_id || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(cap);
  }

  function renderTree(parentId: string | null, indent: number): string {
    const children = byParent.get(parentId) || [];
    return children
      .map((c) => {
        const prefix = "  ".repeat(indent) + "- ";
        const sub = renderTree(c.id, indent + 1);
        return prefix + `[L${c.level}] ${c.name}` + (sub ? "\n" + sub : "");
      })
      .join("\n");
  }

  return renderTree(null, 0);
}
```

---

## Frontend: Upload & Review UI

### Page: `/transcripts/analyze`

**File:** `src/app/(routes)/transcripts/analyze/page.tsx`

```tsx
"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ──

interface ProposedChange {
  id: string;
  change_type: "structural" | "category";
  action?: string;
  target_name: string;
  target_id?: string;
  parent_name?: string;
  category?: string;
  color?: string;
  new_name?: string;
  confidence: number;
  source_quote: string;
  selected: boolean;
  status: string;
}

interface TranscriptStatus {
  id: string;
  status: string;
  progress: number;
  current_step: string;
  error_message?: string;
}

// ── Progress Steps ──

const STEPS = [
  { key: "cleaning", label: "Removing noise", threshold: 10 },
  { key: "extracting", label: "Extracting changes", threshold: 30 },
  { key: "resolving", label: "Resolving against map", threshold: 60 },
  { key: "saving", label: "Preparing review", threshold: 80 },
  { key: "ready_for_review", label: "Ready for review", threshold: 90 },
];

// ── Category Config ──

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  have: { label: "Have", color: "#22c55e", bg: "bg-green-500/20 text-green-400" },
  need: { label: "Need", color: "#ef4444", bg: "bg-red-500/20 text-red-400" },
  in_progress: { label: "In Progress", color: "#eab308", bg: "bg-yellow-500/20 text-yellow-400" },
  planned: { label: "Planned", color: "#3b82f6", bg: "bg-blue-500/20 text-blue-400" },
  retire: { label: "Retire", color: "#6b7280", bg: "bg-gray-500/20 text-gray-400" },
};

const ACTION_CONFIG: Record<string, { label: string; bg: string }> = {
  add: { label: "Add", bg: "bg-green-500/20 text-green-400" },
  remove: { label: "Remove", bg: "bg-red-500/20 text-red-400" },
  rename: { label: "Rename", bg: "bg-purple-500/20 text-purple-400" },
  move: { label: "Move", bg: "bg-blue-500/20 text-blue-400" },
};

export default function TranscriptAnalyzePage() {
  // ── State ──
  const [phase, setPhase] = useState<"upload" | "processing" | "review" | "applying" | "done">("upload");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [changes, setChanges] = useState<ProposedChange[]>([]);
  const [error, setError] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Upload Handler ──
  async function handleUpload() {
    if (text.trim().length < 50) {
      setError("Transcript must be at least 50 characters");
      return;
    }
    setError("");
    setPhase("processing");
    setProgress(5);
    setCurrentStep("Uploading...");

    const res = await fetch("/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, title: title || "Untitled Meeting" }),
    });

    if (!res.ok) {
      setError("Upload failed");
      setPhase("upload");
      return;
    }

    const { transcriptId: id } = await res.json();
    setTranscriptId(id);
    startPolling(id);
  }

  // ── Poll for Progress ──
  function startPolling(id: string) {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/transcripts/${id}`);
      if (!res.ok) return;
      const { transcript, changes: ch } = await res.json();

      setProgress(transcript.progress);
      setCurrentStep(transcript.current_step);

      if (transcript.status === "ready_for_review") {
        clearInterval(pollRef.current!);
        setChanges(ch);
        setPhase("review");
      } else if (transcript.status === "failed") {
        clearInterval(pollRef.current!);
        setError(transcript.error_message || "Processing failed");
        setPhase("upload");
      }
    }, 1500); // Poll every 1.5s
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Toggle Selection ──
  function toggleChange(id: string) {
    setChanges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  }

  function selectAll() {
    setChanges((prev) => prev.map((c) => ({ ...c, selected: true })));
  }

  function deselectAll() {
    setChanges((prev) => prev.map((c) => ({ ...c, selected: false })));
  }

  function selectHighConfidence() {
    setChanges((prev) =>
      prev.map((c) => ({ ...c, selected: c.confidence >= 0.8 }))
    );
  }

  // ── Apply Selected Changes ──
  async function handleApply() {
    const selected = changes.filter((c) => c.selected);
    if (selected.length === 0) {
      setError("Select at least one change to apply");
      return;
    }

    setPhase("applying");
    setProgress(90);
    setCurrentStep("Applying changes...");

    // Save selections
    await fetch(`/api/transcripts/${transcriptId}/changes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selections: changes.map((c) => ({ id: c.id, selected: c.selected })),
      }),
    });

    // Apply
    const res = await fetch(`/api/transcripts/${transcriptId}/apply`, {
      method: "POST",
    });

    if (res.ok) {
      const { results } = await res.json();
      const failed = results.filter((r: any) => !r.success);
      setProgress(100);
      setCurrentStep(failed.length ? `Done (${failed.length} failed)` : "All changes applied!");
      setPhase("done");
    } else {
      setError("Apply failed");
      setPhase("review");
    }
  }

  // ── Render: Upload Phase ──
  if (phase === "upload") {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Analyze Meeting Transcript</h1>
        <p className="text-gray-400 mb-6">
          Paste a meeting transcript and AI will extract capability changes and status assignments.
        </p>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded mb-4">{error}</div>}

        <input
          type="text"
          placeholder="Meeting title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 mb-3"
        />

        <textarea
          placeholder="Paste meeting transcript here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-3 font-mono text-sm mb-4 resize-y"
        />

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium"
          >
            🔍 Analyze Transcript
          </button>
          <span className="text-gray-500 text-sm self-center">
            {text.length} characters
          </span>
        </div>
      </div>
    );
  }

  // ── Render: Processing Phase (Progress Bar) ──
  if (phase === "processing") {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-20">
        <h2 className="text-xl font-bold mb-6">Processing Transcript...</h2>

        {/* Overall progress bar */}
        <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-gray-300 mb-8">{currentStep} ({progress}%)</p>

        {/* Step indicators */}
        <div className="space-y-3">
          {STEPS.map((step) => {
            const isDone = progress > step.threshold;
            const isActive = !isDone && progress >= step.threshold - 20;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs
                  ${isDone ? "bg-green-500 text-white" : isActive ? "bg-blue-500 text-white animate-pulse" : "bg-gray-600 text-gray-400"}`}>
                  {isDone ? "✓" : isActive ? "•" : "○"}
                </div>
                <span className={isDone ? "text-green-400" : isActive ? "text-white" : "text-gray-500"}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render: Review Phase (Multi-Select) ──
  if (phase === "review" || phase === "applying" || phase === "done") {
    const selectedCount = changes.filter((c) => c.selected).length;
    const structuralChanges = changes.filter((c) => c.change_type === "structural");
    const categoryChanges = changes.filter((c) => c.change_type === "category");

    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Review Proposed Changes</h1>
        <p className="text-gray-400 mb-4">
          {changes.length} changes extracted. Select which ones to apply.
        </p>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded mb-4">{error}</div>}

        {/* Bulk actions */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={selectAll} className="px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600">
            Select All
          </button>
          <button onClick={deselectAll} className="px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600">
            Deselect All
          </button>
          <button onClick={selectHighConfidence} className="px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600">
            Select High Confidence (≥80%)
          </button>
          <span className="text-gray-400 text-sm self-center ml-auto">
            {selectedCount} / {changes.length} selected
          </span>
        </div>

        {/* Structural Changes */}
        {structuralChanges.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">
              Structural Changes ({structuralChanges.length})
            </h2>
            <div className="space-y-2">
              {structuralChanges.map((change) => (
                <ChangeRow key={change.id} change={change} onToggle={toggleChange} disabled={phase !== "review"} />
              ))}
            </div>
          </div>
        )}

        {/* Category Assignments */}
        {categoryChanges.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">
              Category Assignments ({categoryChanges.length})
            </h2>
            <div className="space-y-2">
              {categoryChanges.map((change) => (
                <ChangeRow key={change.id} change={change} onToggle={toggleChange} disabled={phase !== "review"} />
              ))}
            </div>
          </div>
        )}

        {/* Apply button */}
        {phase === "review" && (
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
            <button
              onClick={handleApply}
              disabled={selectedCount === 0}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-6 py-2 rounded font-medium"
            >
              ✓ Apply {selectedCount} Change{selectedCount !== 1 ? "s" : ""}
            </button>
            <button
              onClick={() => setPhase("upload")}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Done state */}
        {phase === "done" && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500 rounded">
            <p className="text-green-400 font-medium">✓ {currentStep}</p>
            <p className="text-gray-400 text-sm mt-1">
              Changes have been applied to your capability map. Open the dashboard to see the updates.
            </p>
          </div>
        )}

        {/* Applying progress */}
        {phase === "applying" && (
          <div className="mt-6">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full animate-pulse" style={{ width: "80%" }} />
            </div>
            <p className="text-gray-300 mt-2 text-sm">Applying changes...</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Change Row Component ──

function ChangeRow({
  change,
  onToggle,
  disabled,
}: {
  change: ProposedChange;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  const confidenceColor =
    change.confidence >= 0.85 ? "text-green-400" :
    change.confidence >= 0.6 ? "text-yellow-400" : "text-red-400";

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded border transition-colors cursor-pointer
        ${change.selected ? "bg-gray-800 border-blue-500/50" : "bg-gray-900 border-gray-700 opacity-60"}
        ${disabled ? "pointer-events-none" : "hover:border-gray-500"}`}
      onClick={() => !disabled && onToggle(change.id)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={change.selected}
        onChange={() => onToggle(change.id)}
        disabled={disabled}
        className="mt-1 w-4 h-4 rounded"
      />

      {/* Badge */}
      <div className="flex-shrink-0">
        {change.change_type === "structural" && change.action && (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_CONFIG[change.action]?.bg || "bg-gray-600"}`}>
            {ACTION_CONFIG[change.action]?.label || change.action}
          </span>
        )}
        {change.change_type === "category" && change.category && (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_CONFIG[change.category]?.bg || "bg-gray-600"}`}>
            {CATEGORY_CONFIG[change.category]?.label || change.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{change.target_name}</span>
          {change.new_name && <span className="text-gray-400">→ {change.new_name}</span>}
          {change.parent_name && (
            <span className="text-gray-500 text-sm">under {change.parent_name}</span>
          )}
        </div>
        {change.source_quote && (
          <p className="text-gray-500 text-xs mt-1 italic truncate">
            "{change.source_quote}"
          </p>
        )}
      </div>

      {/* Confidence */}
      <div className={`text-sm font-mono ${confidenceColor}`}>
        {Math.round(change.confidence * 100)}%
      </div>
    </div>
  );
}
```

---

## Progress Bar Stages (Visual)

```
Upload          Clean Noise      Extract AI       Resolve Map      Review Ready
  │                │                 │                │                │
  ▼                ▼                 ▼                ▼                ▼
 [██░░░░░░░░░░░░░░░░░░] 10%
 [██████░░░░░░░░░░░░░░] 30%
 [████████████░░░░░░░░] 60%
 [████████████████░░░░] 80%
 [██████████████████░░] 90%  ← User reviews here
 [████████████████████] 100% ← After apply
```

Each step shows:
- ✓ Green check when complete
- • Blue pulse when active
- ○ Gray when pending

---

## File Structure

```
src/
├── app/
│   ├── (routes)/
│   │   └── transcripts/
│   │       └── analyze/
│   │           └── page.tsx          ← Upload + Review UI
│   └── api/
│       └── transcripts/
│           ├── route.ts              ← POST upload
│           └── [id]/
│               ├── route.ts          ← GET status/changes
│               ├── changes/
│               │   └── route.ts      ← PATCH selections
│               └── apply/
│                   └── route.ts      ← POST execute
├── lib/
│   └── transcript/
│       └── processTranscript.ts      ← Pipeline logic
```

---

## Key UX Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auto-select threshold | ≥70% confidence | Reduces manual work while flagging uncertain items |
| Polling interval | 1.5s | Fast enough to feel real-time, not too chatty |
| Progress steps | 5 stages | Granular enough to show meaningful progress |
| Grouped display | Structural vs Category | Clear mental model for the user |
| Source quote shown | Always (truncated) | Traceability — user sees WHY the AI made the suggestion |
| Color preview | Show swatch next to category badge | Immediate visual feedback of what the map will look like |

---

## Edge Cases & Error Handling

| Case | Handling |
|------|----------|
| Empty extraction (no changes found) | Show "No capability-related changes detected" message with option to re-upload |
| AI returns malformed JSON | Retry once with stricter prompt; if still fails, mark as failed |
| Capability not found on map (for category) | Mark as "new" — suggest adding it first |
| Duplicate changes extracted | Deduplicate by target_name + action/category, keep highest confidence |
| Very long transcript (>50K chars) | Chunk into ~12K segments, process each, merge + deduplicate |
| User refreshes during processing | Polling resumes from current state (status persisted in DB) |
| Apply partially fails | Show per-change success/failure badges |

---

## Token Cost Estimate

| Meeting Length | ~Transcript Size | Clean Step | Extract Step | Total Cost |
|---------------|-----------------|------------|--------------|------------|
| 30 min | ~5K words | Free (regex) | ~$0.005 | ~$0.005 |
| 60 min | ~12K words | Free (regex) | ~$0.012 | ~$0.012 |
| 90 min | ~18K words | Free (regex) | ~$0.020 (2 chunks) | ~$0.020 |


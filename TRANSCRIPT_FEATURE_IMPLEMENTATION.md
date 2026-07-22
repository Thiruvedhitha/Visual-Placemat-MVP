# Meeting Transcript → Capability Map — Step-by-Step Setup

Approach used: **Single-Pass LLM Extraction** (Approach A from `TRANSCRIPT_FEATURE_ALTERNATIVES.md`).

Design principles that differ from a naive first draft:
- **Reuse the existing `DiagramCommand` executor** (`src/lib/commands/index.ts`, `executor.ts`). Do **not** write to `capabilities` / node styles directly — apply everything through commands so the canvas, undo stack, legend, and DB stay in sync.
- **Reuse the existing `/api/transform` prompt builder** (`src/lib/commands/promptBuilder.ts`) for the "generate commands from todos" step.
- **Reuse the current legend** (per-catalog, editable) instead of hard-coding categories/colors.
- **Synchronous processing** (Approach A is 3–5s) — no background worker, no fire-and-forget.
- **Persist an audit trail** (transcript + proposed changes) so users can re-review or re-apply later.

---

## Prerequisites

- OpenAI key present as `OPENAI_API_KEY` (already required by `/api/transform`).
- Supabase env vars present (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- User can already open a catalog on the canvas.

---

## Step 1 — Database migration

Create `docker/migrations/20260722_transcript_processing.sql` (or wherever migrations already live — check `docker/` folder before creating a new path).

```sql
-- Store uploaded meeting transcripts
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id    uuid REFERENCES capability_catalogs(id) ON DELETE CASCADE,
  title         text,
  raw_text      text NOT NULL,
  cleaned_text  text,
  understanding text,                                  -- AI's summary of the transcript
  status        text NOT NULL DEFAULT 'uploaded',
  -- uploaded → cleaning → extracting → ready_for_review → applying → completed | failed
  progress      int  NOT NULL DEFAULT 0,               -- 0..100
  current_step  text,
  error_message text,
  created_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_catalog
  ON meeting_transcripts(catalog_id);

-- Store the AI's proposed DiagramCommand-shaped changes for review
CREATE TABLE IF NOT EXISTS proposed_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id   uuid NOT NULL REFERENCES meeting_transcripts(id) ON DELETE CASCADE,

  todo_text       text NOT NULL,           -- human-readable action item extracted from transcript
  source_quote    text,                    -- verbatim transcript snippet
  confidence      numeric(3,2) NOT NULL DEFAULT 0.5,

  -- The actual DiagramCommand this todo will execute (JSONB, shape defined in src/lib/commands/index.ts)
  command         jsonb NOT NULL,

  selected        boolean NOT NULL DEFAULT true,   -- user's checkbox state
  status          text NOT NULL DEFAULT 'pending', -- pending | accepted | declined | applied | failed
  apply_error     text,
  sort_order      int  NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposed_changes_transcript
  ON proposed_changes(transcript_id);
```

Apply the migration through whatever mechanism this repo already uses (check `docker/` and `mvp_db.md`). Only two new tables; no changes to `capabilities` / `capability_catalogs`.

> **Auth note:** the current app doesn't filter `capability_catalogs` by `user_id` at MVP scale (see [mvp_db.md](mvp_db.md)). Match that pattern — do **not** add `user_id` here. When multi-user is introduced in v2, add it to both tables in the same migration.

---

## Step 2 — Types

Add to [src/lib/commands/index.ts](src/lib/commands/index.ts) (append, don't touch the existing `DiagramCommand` union):

```ts
export interface TranscriptTodo {
  id: string;                    // stable id from AI (e.g. "t1")
  text: string;                  // human-readable action item
  quote: string;                 // verbatim transcript snippet
  confidence: number;            // 0..1
  command: DiagramCommand;       // the exact command that executes this todo
}

export interface TranscriptAnalysis {
  understanding: string;         // 2-3 sentence AI summary of the meeting
  todos: TranscriptTodo[];
}
```

The key change vs. the old draft: **every todo owns one `DiagramCommand`**. This is what makes the whole thing route through the existing executor.

---

## Step 3 — Prompt builder

Append one function to [src/lib/commands/promptBuilder.ts](src/lib/commands/promptBuilder.ts). It should:

1. Emit the same node/legend context that `buildCommandPrompt` already emits (reuse its internals — extract a shared helper if needed).
2. Add transcript-specific instructions:
   - Extract only **capability-relevant** actions (add/remove/rename/reparent/style/note/legend).
   - For every todo, emit **one `DiagramCommand`** using the same schema as `buildCommandPrompt`.
   - Ignore hypotheticals ("if we had…", "maybe we should…").
   - Deduplicate — if the same capability is discussed multiple times, use the **final/strongest** signal.
   - Include a `quote` (verbatim ≤ 200 chars) for every todo.
   - Include a `confidence` (0.9+ explicit decision, 0.6–0.8 implied, <0.6 ambiguous).
   - Return this exact JSON shape:

     ```json
     {
       "understanding": "…",
       "todos": [
         {
           "id": "t1",
           "text": "Rename 'Sales Ops' to 'Revenue Operations'",
           "quote": "…verbatim…",
           "confidence": 0.95,
           "command": { "type": "RENAME_NODE", "nodeId": "…uuid…", "newName": "Revenue Operations" }
         }
       ]
     }
     ```

3. Pass the current legend (like `buildCommandPrompt` does) so the AI emits `SET_STYLE` / `SET_LEGEND` using the **user's own category labels and colors** rather than hard-coded `have/need/planned/…`.

Function signature:

```ts
export function buildTranscriptPrompt(
  capabilities: Capability[],
  nodeStyles: Record<string, NodeStylePatch>,
  legend: LegendConfig | undefined,
  allCapabilities: Capability[],
): string
```

---

## Step 4 — Processing helper

Create `src/lib/transcript/processTranscript.ts`.

```ts
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { buildTranscriptPrompt } from "@/lib/commands/promptBuilder";
import type { TranscriptAnalysis } from "@/lib/commands/index";
import type { Capability } from "@/types/capability";

const MAX_TRANSCRIPT_CHARS = 60_000; // ~15K words — matches the "when to reconsider" line in the alternatives doc

export function cleanTranscript(raw: string): string {
  let t = raw;
  t = t.replace(/\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*/g, "");                        // timestamps
  t = t.replace(/\b(um|uh|uhh|hmm|you know|like|basically|actually)\b/gi, ""); // fillers
  t = t.replace(/\[(inaudible|crosstalk|laughter|pause|silence)\]/gi, "");     // caption artefacts
  t = t.replace(/^.*\b(mute|unmute|can you hear me|screen share|you're on mute)\b.*$/gim, "");
  t = t.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
  return t
    .split("\n")
    .filter((line) => line.trim().length >= 5)
    .join("\n")
    .trim();
}

export async function analyzeTranscript(args: {
  transcriptId: string;
  cleaned: string;
  capabilities: Capability[];
  nodeStyles: Record<string, unknown>;
  legend: unknown;
}): Promise<TranscriptAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const openai = new OpenAI({ apiKey });
  const systemPrompt = buildTranscriptPrompt(
    args.capabilities,
    args.nodeStyles as never,
    args.legend as never,
    args.capabilities,
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    max_tokens: 8192,
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: args.cleaned },
    ],
  });

  // TODO: mirror /api/transform's usage logging + salvage-on-truncation logic
  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as TranscriptAnalysis;
  parsed.todos = Array.isArray(parsed.todos) ? parsed.todos : [];
  return parsed;
}

export function truncateIfNeeded(text: string): string {
  return text.length > MAX_TRANSCRIPT_CHARS ? text.slice(0, MAX_TRANSCRIPT_CHARS) : text;
}
```

> **v2 upgrade path (chunking):** if transcripts routinely exceed `MAX_TRANSCRIPT_CHARS`, split on double-newline boundaries into ~50K-char chunks, call `analyzeTranscript` per chunk, and merge todos by de-duping on `command.type + command.nodeId`.

---

## Step 5 — API routes

Four routes under `src/app/api/transcripts/`.

### 5.1 `POST /api/transcripts` — upload, clean, extract (synchronous)

`src/app/api/transcripts/route.ts`

```ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { cleanTranscript, analyzeTranscript, truncateIfNeeded } from "@/lib/transcript/processTranscript";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as
    | { catalogId: string; text: string; title?: string }
    | null;

  if (!body?.text || body.text.trim().length < 50) {
    return NextResponse.json({ error: "Transcript too short" }, { status: 400 });
  }
  if (!body.catalogId) {
    return NextResponse.json({ error: "catalogId is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1) Insert the transcript row
  const { data: transcript, error: insertErr } = await supabase
    .from("meeting_transcripts")
    .insert({
      catalog_id: body.catalogId,
      title: body.title || "Untitled meeting",
      raw_text: body.text,
      status: "cleaning",
      progress: 10,
      current_step: "Removing noise",
    })
    .select()
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  try {
    // 2) Clean
    const cleaned = cleanTranscript(truncateIfNeeded(body.text));
    await supabase.from("meeting_transcripts").update({
      cleaned_text: cleaned, status: "extracting", progress: 40, current_step: "Extracting changes",
    }).eq("id", transcript.id);

    // 3) Load canvas context (capabilities + legend + node styles)
    const [{ data: caps }, { data: catalog }] = await Promise.all([
      supabase.from("capabilities").select("*").eq("catalog_id", body.catalogId).order("sort_order"),
      supabase.from("capability_catalogs").select("*").eq("id", body.catalogId).single(),
    ]);

    // 4) Single-pass LLM extraction — returns todos each carrying a DiagramCommand
    const analysis = await analyzeTranscript({
      transcriptId: transcript.id,
      cleaned,
      capabilities: caps ?? [],
      nodeStyles: (catalog as { node_styles?: Record<string, unknown> } | null)?.node_styles ?? {},
      legend: (catalog as { legend?: unknown } | null)?.legend ?? null,
    });

    // 5) Persist proposed changes
    const rows = analysis.todos.map((t, i) => ({
      transcript_id: transcript.id,
      todo_text: t.text,
      source_quote: t.quote ?? "",
      confidence: t.confidence ?? 0.5,
      command: t.command,
      selected: (t.confidence ?? 0.5) >= 0.7,     // auto-select high confidence
      sort_order: i,
    }));
    if (rows.length > 0) {
      const { error: rowsErr } = await supabase.from("proposed_changes").insert(rows);
      if (rowsErr) throw new Error(rowsErr.message);
    }

    await supabase.from("meeting_transcripts").update({
      understanding: analysis.understanding,
      status: "ready_for_review",
      progress: 90,
      current_step: "Ready for review",
    }).eq("id", transcript.id);

    return NextResponse.json({ transcriptId: transcript.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await supabase.from("meeting_transcripts").update({
      status: "failed", error_message: message, current_step: "Failed",
    }).eq("id", transcript.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### 5.2 `GET /api/transcripts/[id]` — fetch transcript + proposed changes

`src/app/api/transcripts/[id]/route.ts` — straight read; select from both tables and return `{ transcript, changes }`.

### 5.3 `PATCH /api/transcripts/[id]/changes` — toggle selection

`src/app/api/transcripts/[id]/changes/route.ts` — accepts `{ selections: [{ id, selected }] }`, updates `selected` + sets `status` to `accepted` / `declined`.

### 5.4 `POST /api/transcripts/[id]/apply` — hand off to the client

Instead of executing the commands server-side (which would require duplicating the executor + would not update the open canvas in real time), this route simply returns the selected commands and marks them `applied`. The **client** feeds them into `onAICommands()` — the exact same code path used by the chat sidebar today.

```ts
// POST /api/transcripts/[id]/apply
// Returns: { commands: DiagramCommand[], todos: TranscriptTodo[], summary: string }
```

The route also writes one commit entry to `capability_catalogs.chat_history.commits` (via [src/app/api/chat/route.ts](src/app/api/chat/route.ts) `PUT`) so the transcript appears in the existing Version History panel.

---

## Step 6 — Frontend page

`src/app/(routes)/transcripts/analyze/page.tsx`.

Reuse the visuals from the old draft (upload → progress → review → done), but wire the **apply** step to the canvas store so it round-trips through `DiagramCommand`.

Skeleton:

```tsx
"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCatalogStore } from "@/stores/catalogStore";
import type { DiagramCommand } from "@/lib/commands/index";

export default function AnalyzeTranscriptPage() {
  const params = useSearchParams();
  const router = useRouter();
  const catalogId = params.get("catalogId");
  const applyCommands = useCatalogStore((s) => s.applyCommands); // existing action used by AIMapEditor

  // 1) upload → POST /api/transcripts → transcriptId
  // 2) GET /api/transcripts/:id → renders review UI
  // 3) checkbox toggles → PATCH /api/transcripts/:id/changes
  // 4) Apply → POST /api/transcripts/:id/apply → returns commands
  //          → applyCommands(commands)    // <-- reuses existing executor
  //          → router.push(`/dashboard?catalogId=${catalogId}`)
}
```

> Confirm the exact store action name in [src/stores/catalogStore.ts](src/stores/catalogStore.ts); `AIMapEditor` calls it via the `onAICommands` prop, so either export a matching store method or route through the same handler used on the canvas page.

UI details worth keeping from the earlier draft:
- Progress bar with 5 labelled steps.
- Bulk actions: **Select all / Deselect all / Select high confidence (≥ 80 %)**.
- Two grouped sections: **Structural changes** (`ADD_NODE`, `RENAME_NODE`, `REPARENT_NODE`, `DELETE_NODE`) vs. **Style / notes / legend** (`SET_STYLE`, `SET_NOTE`, `SET_LEGEND`, `RESET_STYLE`, `SET_TEXT_COLOR`, `SET_DESCRIPTION`).
- Confidence badge coloured green/yellow/red.
- Verbatim source quote under each row.

---

## Step 7 — Entry points

Add one entry point on the canvas so users discover the feature.

1. In [src/components/canvas/AIMapEditor.tsx](src/components/canvas/AIMapEditor.tsx) near `AI_QUICK_ACTIONS`, add:

   ```ts
   { icon: "📋", label: "Import meeting transcript", href: "/transcripts/analyze" }
   ```

   (or push a new modal — see below).

2. **Preferred variant:** open a modal from the sidebar rather than navigating away, then submit to `/api/transcripts` with the current `catalogId` and take the user to the review view on success. Reuses less state and keeps the canvas mounted.

3. Optional: link to `/transcripts/analyze` from the Dashboard "Entry cards" list ([src/components/ui/EntryCards.tsx](src/components/ui/EntryCards.tsx)).

---

## Step 8 — Version history / audit

- Every apply writes a `CommitEntry` (see [src/app/api/chat/route.ts](src/app/api/chat/route.ts) `PUT`) with:
  - `prompt: "Transcript: <title>"`
  - `summary: transcript.understanding`
  - `adds / deletes / renames / styles` counts computed by `summarizeCommands()` (already lives in [src/components/canvas/AIMapEditor.tsx](src/components/canvas/AIMapEditor.tsx)) — extract it into `src/lib/commands/index.ts` so both call sites can share it.

- The `meeting_transcripts` and `proposed_changes` rows remain in the DB for later audit ("what changes did the July 22 meeting produce?") without polluting the chat history.

---

## Step 9 — Cost / usage logging

Copy the block from [src/app/api/transform/route.ts](src/app/api/transform/route.ts) (`response.usage → appendUsageLog`) into `analyzeTranscript` so transcript analyses show up in the existing usage dashboard. Label them `mode: "transcript"`.

---

## Step 10 — Manual test checklist

1. Load a catalog on the canvas.
2. Open **Import meeting transcript**; paste a short sample transcript containing:
   - one rename (`Rename 'X' to 'Y'`),
   - one add (`add L2 'AI Governance' under 'Risk'`),
   - one status colour (`we already have 'Order Management'`).
3. Verify:
   - `meeting_transcripts` row appears in DB.
   - `proposed_changes` rows appear with `command.type` matching each todo.
   - Review UI shows 3 rows grouped correctly with quotes + confidence.
4. Uncheck one, click **Apply**.
5. Verify:
   - Canvas updates live (goes through `onAICommands` → executor).
   - `chat_history.commits` has a new entry.
   - `proposed_changes.status` is `applied` for selected, `declined` for unchecked.
6. Refresh the canvas — changes persist (they were applied through the same code path chat uses).

---

## File map

```
src/
├── app/
│   ├── (routes)/transcripts/analyze/page.tsx     ← Step 6
│   └── api/transcripts/
│       ├── route.ts                              ← Step 5.1 (POST)
│       └── [id]/
│           ├── route.ts                          ← Step 5.2 (GET)
│           ├── changes/route.ts                  ← Step 5.3 (PATCH)
│           └── apply/route.ts                    ← Step 5.4 (POST)
├── lib/
│   ├── commands/
│   │   ├── index.ts                              ← Step 2 (types)
│   │   └── promptBuilder.ts                      ← Step 3 (buildTranscriptPrompt)
│   └── transcript/
│       └── processTranscript.ts                  ← Step 4
└── components/
    └── canvas/AIMapEditor.tsx                    ← Step 7 (sidebar entry)

docker/migrations/
└── 20260722_transcript_processing.sql            ← Step 1
```

---

## Rollout order (small verifiable increments)

1. **Migration** (Step 1) — apply, confirm tables exist.
2. **Types + prompt builder** (Steps 2–3) — no runtime yet; type-check only.
3. **`processTranscript` + `POST /api/transcripts`** (Steps 4, 5.1) — curl a sample transcript, inspect returned `transcriptId` and `proposed_changes` rows.
4. **`GET` route + minimal review page** (Steps 5.2, 6) — render the todo list read-only.
5. **`PATCH` + `apply` routes** (Steps 5.3–5.4) — end-to-end via `onAICommands`.
6. **Sidebar entry, commit history, usage logging** (Steps 7–9).
7. **Manual test pass** (Step 10).

Each increment leaves the app in a working state.

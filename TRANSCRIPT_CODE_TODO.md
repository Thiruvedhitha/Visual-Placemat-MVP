# Meeting Transcript → Diagram — Build Checklist

> **Read [TRANSCRIPT_TECHNICAL_GUIDE.md](TRANSCRIPT_TECHNICAL_GUIDE.md) first.**
> That doc has the architecture, DB schema, prompt notes, and — critically —
> a list of **rejected approaches with reasons**. Don't re-invent solutions
> that are already documented as dead-ends.
>
> Work top-to-bottom. Each step ends with a verifiable check. Do not skip
> checks — the pipeline is easier to debug incrementally than end-to-end.

---

## Step 0 — Prerequisites

- [ ] Run [scripts/migrations/2026-08-03_meeting_transcripts.sql](scripts/migrations/2026-08-03_meeting_transcripts.sql) in Supabase SQL editor.
- [ ] Verify: `SELECT COUNT(*) FROM public.meeting_transcripts;` returns `0` (not an error).
- [ ] Verify: `SELECT COUNT(*) FROM public.transcript_proposals;` returns `0`.
- [ ] Confirm `OPENAI_API_KEY` is set in `.env.local` (already used by `/api/transform`).
- [ ] `npm install mammoth` — server-side .docx parser.

---

## Step 1 — Type definitions

Create `src/types/transcript.ts`:

```ts
import type { DiagramCommand } from "@/lib/commands";

export type TranscriptMode = "new_diagram" | "edit_diagram";

export type TranscriptStatus =
  | "uploaded" | "parsing" | "cleaning" | "filtering"
  | "extracting" | "resolving" | "ready_for_review"
  | "applying" | "completed" | "failed";

export interface MeetingTranscript {
  id: string;
  user_id: string;
  catalog_id: string | null;
  mode: TranscriptMode;
  title: string | null;
  meeting_date: string | null;      // ISO date
  raw_text: string;
  cleaned_text: string | null;
  summary: string | null;
  status: TranscriptStatus;
  progress: number;                 // 0–100
  current_step: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── Proposal payloads (union by `kind`) ─────────────────────────────────────

export interface NodeProposalPayload {
  tempId: string;
  parentTempId: string | null;
  level: 0 | 1 | 2 | 3;
  name: string;
  description?: string;
}

export interface TodoProposalPayload {
  text: string;
  targetNodeId?: string | null;     // resolved existing capability id
  targetName?: string | null;       // AI-suggested target name (may be fuzzy)
  priority: "low" | "medium" | "high";
  owner?: string | null;
  sourceQuote: string;
}

export type CommandProposalPayload = DiagramCommand & {
  rationale?: string;
};

export type ProposalKind = "node" | "command" | "todo";
export type ProposalStatus = "pending" | "accepted" | "declined" | "applied" | "failed";

export interface TranscriptProposal {
  id: string;
  transcript_id: string;
  kind: ProposalKind;
  payload:
    | NodeProposalPayload
    | CommandProposalPayload
    | TodoProposalPayload;
  confidence: number;
  source_quote: string | null;
  selected: boolean;
  status: ProposalStatus;
  apply_error: string | null;
  sort_order: number;
  created_at: string;
}
```

- [ ] File created and imports resolve (`npm run build` type-check passes).

---

## Step 2 — File parsers (no LLM cost, testable standalone)

### 2a. `src/lib/transcript/parseVtt.ts`

Hand-rolled — do NOT add a `webvtt-parser` dep (see rejected approach H).

```ts
export function parseVtt(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line === "WEBVTT") continue;
    if (/^\d+$/.test(line.trim())) continue;                       // cue number
    if (/-->/.test(line)) continue;                                // timestamp
    if (/^NOTE\b/.test(line) || /^STYLE\b/.test(line)) continue;
    out.push(line.trim());
  }
  return out.join("\n");
}
```

- [ ] Unit-test with a sample Teams `.vtt` file (find one online or export one from a real meeting).

### 2b. `src/lib/transcript/parseDocx.ts`

```ts
import mammoth from "mammoth";

export async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
```

- [ ] Test with any `.docx` file — verify text extraction is non-empty.

### 2c. `src/lib/transcript/clean.ts`

Implement every rule from §7 of the technical guide. Keep a `sourceMap: Map<cleanedLineIdx, originalLineIdx>` so we can rebuild `sourceQuote`s later.

```ts
export interface CleanResult {
  cleaned: string;
  sourceMap: number[];  // cleanedLineIdx → originalLineIdx
}

export function cleanTranscript(raw: string): CleanResult { /* ... */ }
```

- [ ] Test: feed a 500-line raw transcript, cleaned output should be 40–60% smaller.
- [ ] Test: `sourceMap.length` equals number of cleaned lines.

---

## Step 3 — POST /api/transcripts (create row)

`src/app/api/transcripts/route.ts`

- Auth: reuse `getUser()` pattern from other routes (check `src/lib/auth/getUser` if it exists, else copy the pattern from [src/app/api/chat/route.ts](src/app/api/chat/route.ts)).
- Accept `multipart/form-data` OR JSON:
  - JSON body: `{ mode, title?, meetingDate?, text, catalogId? }`
  - Multipart: `file` field (`.txt`/`.docx`/`.vtt`) + other fields.
- Route by file extension → `parseVtt` / `parseDocx` / passthrough for `.txt`.
- Reject if resulting `text.length < 200` chars → `400 { error: "Transcript too short" }`.
- Reject if `mode === 'edit_diagram'` but no `catalogId` → `400`.
- Insert row with `status='uploaded'`, `progress=0`.
- Return `{ id }`.

- [ ] `curl -X POST` with a `.txt` file returns an id.
- [ ] Row exists in `meeting_transcripts` with `raw_text` populated.
- [ ] Uploading a 100-char text returns 400.

Also implement:

- [ ] `GET /api/transcripts` — paginated list for current user, most-recent first. Query params: `limit`, `offset`, `catalogId?`.

---

## Step 4 — Extraction passes (LLM calls, no orchestration yet)

Each pass is a **pure function** that takes text + returns parsed JSON. No DB writes.
All three use `openai.chat.completions.create` with `response_format: { type: "json_object" }`, `model: "gpt-4.1-mini"`, `temperature: 0.2`.

### 4a. `src/lib/transcript/pass1-filter.ts`

Input: `cleaned: string`
Output: `filtered: string` (still text, not JSON — but wrap in JSON envelope: `{ "keptText": "..." }` for reliability).

**Prompt shape:**
```
System: You are filtering a business meeting transcript. Keep only paragraphs
that discuss capabilities, processes, tools, systems, roles, priorities, or
action items. Drop small-talk, scheduling admin, and off-topic tangents.
Return JSON: { "keptText": "<transcript with irrelevant paragraphs removed>" }.

User: <cleaned transcript>
```

- [ ] Run manually against a real transcript — filtered output should be 30–70% of input length.
- [ ] Retry logic: if JSON.parse fails, log once and re-call with `"You MUST return valid JSON."` appended.

### 4b. `src/lib/transcript/pass2-extract.ts`

Two flavours in one file, dispatched by `mode`:

```ts
export async function pass2Extract(
  filteredText: string,
  mode: TranscriptMode,
  ctx: { capabilities?: Capability[]; nodeStyles?: Record<string, NodeStylePatch>; legend?: ... }
): Promise<{ nodes: NodeProposalPayload[] } | { commands: CommandProposalPayload[] }>;
```

**`new_diagram` prompt:** ask for a full capability tree in JSON. Level 0 = top-level domains; levels 1–3 nested. Include every proposed node as its own array entry with `parentTempId` linking to another `tempId`. Include `confidence` per node.

**`edit_diagram` prompt:** include the existing tree as YAML (token-efficient), current node_styles, legend. Ask for `DiagramCommand[]` with `confidence`, `sourceQuote`, `rationale` per command. Cite the exact `DiagramCommand` union from [src/lib/commands/index.ts](src/lib/commands/index.ts) — copy the JSDoc into the system prompt so the model knows every valid `type`.

- [ ] Manual test both modes with sample transcripts.
- [ ] Every emitted proposal has `confidence` ∈ [0,1] and `sourceQuote` non-empty.

### 4c. `src/lib/transcript/pass3-todos.ts`

Input: `filteredText`, plus a `summaryContext` describing what Pass 2 proposed (so TODOs can reference proposed nodes by name).

Output: `{ summary: string, todos: TodoProposalPayload[] }`.

Prompt asks for:
- `summary`: 3–5 sentences of what the meeting decided.
- `todos`: array of action items; each has `text`, optional `targetName`, `priority`, optional `owner`, required `sourceQuote`.

- [ ] Manual test — summary should read like a human-written recap.

---

## Step 5 — Fuzzy resolver

`src/lib/transcript/resolve.ts`

For `edit_diagram` mode and TODO `targetName` linking:

- Given a proposed capability name string, return the best matching existing capability id (or null if no match ≥ threshold).
- Algorithm: normalize (lowercase, strip punctuation, collapse whitespace) → Levenshtein similarity. Threshold: 0.85.
- **Do NOT use embeddings** (see rejected approach C — too expensive for our tree sizes).

```ts
export function resolveCapabilityName(
  proposed: string,
  existing: Capability[]
): { id: string; confidence: number } | null;
```

- [ ] Test: "Risk Management" matches "Risk & Compliance Management" at ~0.6 (below threshold → null). "Risk Mgmt" matches "Risk Management" at ~0.9 → match.

---

## Step 6 — Pipeline orchestrator + SSE stream

### 6a. `src/lib/transcript/pipeline.ts`

```ts
export async function* runPipeline(
  transcriptId: string,
  emit: (event: { progress: number; step: string }) => void
): AsyncGenerator<void>;
```

Reads the transcript row, runs each pass, writes cleaned_text and proposal rows, updates progress after each stage. On any thrown error, set `status='failed'`, `error_message=<message>`, and re-throw.

**Order:**
1. progress 5% "Parsing" (no-op if already parsed at upload; kept for progress bar smoothness)
2. progress 15% "Cleaning" → run `cleanTranscript`, save `cleaned_text`
3. progress 30% "Filtering" → Pass 1
4. progress 55% "Extracting" → Pass 2
5. progress 80% "Extracting TODOs" → Pass 3
6. progress 95% "Resolving names" → for edit_diagram, resolve every command's `nodeId` against existing tree; for TODOs, resolve `targetName` → `targetNodeId`
7. Insert all rows into `transcript_proposals` with correct `kind`, `payload`, `confidence`, `source_quote`, `sort_order`
8. progress 100%, `status='ready_for_review'`

### 6b. `src/app/api/transcripts/[id]/stream/route.ts`

Server-Sent Events endpoint. Verify ownership, then:

```ts
const stream = new ReadableStream({
  async start(controller) {
    const emit = (evt: object) => {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(evt)}\n\n`));
    };
    try {
      await runPipeline(id, emit);
      emit({ done: true });
    } catch (e: any) {
      emit({ error: e.message });
    }
    controller.close();
  }
});
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive"
  }
});
```

- [ ] Test with a real transcript: open the SSE endpoint from a browser tab, watch progress events arrive.
- [ ] After completion, `SELECT * FROM transcript_proposals WHERE transcript_id = '<id>'` returns rows.

**Gotcha:** Next.js on Vercel needs `export const runtime = "nodejs"` for streaming — verify this doesn't break your existing routes' assumptions.

---

## Step 7 — Read + update proposals

### 7a. `GET /api/transcripts/[id]/route.ts`

Return `{ transcript, proposals: { nodes: [], commands: [], todos: [] } }` grouped by kind.

### 7b. `PATCH /api/transcripts/[id]/proposals/route.ts`

Body: `{ selections: Array<{ id: string; selected: boolean; payloadEdits?: object }> }`

- For each selection, update `selected` and `status` (`accepted` if selected else `declined`).
- If `payloadEdits` provided (user edited TODO text or node name), merge into `payload` JSON.
- Return `{ ok: true }`.

- [ ] Batch update 10 rows in one request.
- [ ] Verify `SELECT status FROM transcript_proposals` matches expectations.

---

## Step 8 — Apply flows

### 8a. `src/lib/transcript/applyNew.ts`

For `mode='new_diagram'`:

- Read all accepted `kind='node'` proposals.
- Build a `tempId → uuid` map (assign fresh uuids).
- Create a `capability_catalogs` row (use transcript title, current user).
- Insert `capabilities` rows in level order (L0 first) so `parent_id` FKs resolve. Map `parentTempId → parent uuid`.
- Read accepted `kind='todo'` proposals with a resolved `targetName`. For each, fuzzy-match against the just-created tree and append TODO text to `capabilities.note`.
- Update `meeting_transcripts` row: `catalog_id`, `status='completed'`, `completed_at`.
- Return `{ catalogId }`.

### 8b. `src/lib/transcript/applyEdit.ts`

For `mode='edit_diagram'`:

- Read the catalog's current capabilities.
- Read accepted `kind='command'` proposals → build `DiagramCommand[]`.
- Load existing `nodeStyles` from `capability_catalogs.node_styles`.
- Call `executeCommands(commands, capabilities, nodeStyles)` from [src/lib/commands/executor.ts](src/lib/commands/executor.ts).
- Persist result: update `capabilities` table for structural changes; merge `nodePatches` into `capability_catalogs.node_styles`.
- Apply accepted `kind='todo'` proposals with `targetNodeId` → append to `capabilities.note`.
- Append a commit entry to `chat_history.commits[]`:
  ```ts
  { prompt: "Transcript: <title>", summary: transcript.summary,
    adds, deletes, renames, styles, ts: new Date().toISOString() }
  ```
- Update `meeting_transcripts` row: `status='completed'`, `completed_at`.
- Return `{ ok: true, appliedCount }`.

### 8c. `POST /api/transcripts/[id]/apply/route.ts`

- Verify ownership.
- Verify transcript `status='ready_for_review'`.
- Update status → `'applying'`, progress → 95.
- Dispatch to `applyNew` or `applyEdit` by mode.
- On per-row failure, mark that proposal `status='failed'`, `apply_error=<msg>`, continue with the rest.
- Return `{ appliedCount, failedCount, catalogId? }`.

- [ ] End-to-end: upload → wait for review → PATCH selections → POST apply → new catalog appears in dashboard.

---

## Step 9 — UI: shared review modal

### 9a. `src/components/transcript/TranscriptReviewModal.tsx`

Props:
```ts
{
  transcriptId: string;
  mode: TranscriptMode;
  onClose: () => void;
  onApplied: (result: { catalogId?: string }) => void;
}
```

Fetches `GET /api/transcripts/:id` on mount. Tab layout by mode:

| Mode | Tabs |
|------|------|
| `new_diagram` | Summary, **Nodes**, TODOs |
| `edit_diagram` | Summary, **Commands**, TODOs |

**Nodes tab:** rendered as a nested tree with a checkbox per node. Unchecking a parent auto-unchecks descendants. Inline-edit node names on click.

**Commands tab:** flat list. Each row: `[✓] <human-readable action> · <confidence badge> · "<sourceQuote>"`. Click row to expand → shows raw `DiagramCommand` JSON.

**TODOs tab:** checkbox list. Each row: `[✓] <text> · <priority pill> · owner: <name> · <target node name if any>`. Inline-edit text.

**Bottom bar:** "Apply N selected" button (disabled if 0 selected). PATCHes selections then POSTs apply.

- [ ] Modal opens, shows loading state during pipeline.
- [ ] Once ready, all tabs populated correctly.
- [ ] Unchecking + Apply → only checked items land on the diagram.

### 9b. `src/components/transcript/ProgressBar.tsx`

Consumes SSE from `/api/transcripts/:id/stream`. Displays progress% + current step. Closes when `done: true` received.

### 9c. `src/components/transcript/TranscriptUpload.tsx`

- Paste-into-textarea (auto-detects VTT format).
- Drag-drop or file picker for `.txt` / `.docx` / `.vtt`.
- Meeting title input (required).
- Meeting date input (defaults to today).
- Submit → POST `/api/transcripts` → open ProgressBar → on `done` open ReviewModal.

- [ ] Drag a `.docx` file — parsed correctly.
- [ ] Paste raw VTT — auto-detected and parsed.

---

## Step 10 — Entry points

### 10a. Homepage card

Edit [src/components/ui/EntryCards.tsx](src/components/ui/EntryCards.tsx):

- Change grid to `sm:grid-cols-3`.
- Add a third card object next to `Upload Excel / CSV`:
  ```
  title: "Start with Transcript"
  subtitle: "Paste a meeting → auto-generate diagram"
  icon: <docs icon>
  ```
- Card opens `TranscriptUpload` modal with `mode='new_diagram'`.

- [ ] Card renders. Click opens modal.

### 10b. Canvas RightSidebar button

Edit [src/components/canvas/RightSidebar.tsx](src/components/canvas/RightSidebar.tsx):

- Add a "From transcript" button in the AI chat panel section.
- Click opens `TranscriptUpload` modal with `mode='edit_diagram'` and `catalogId=<current>`.
- On success, refresh the canvas capabilities from the server.

- [ ] Button appears. Uploading + applying → diagram updates without full reload.

### 10c. History page

`src/app/(routes)/transcripts/page.tsx`:

- Lists user's past transcripts (from `GET /api/transcripts`).
- Each row: title, date, mode, status, "Review" button (if `ready_for_review`) or "Re-open" (if `completed` — reopens read-only view of what was applied).

- [ ] Page shows recent transcripts. Status pill matches DB.

---

## Step 11 — QA pass

- [ ] Run `npm run build` — no TypeScript errors.
- [ ] Full new-diagram flow with a 3k-word real transcript. Confirm resulting tree is sensible.
- [ ] Full edit-diagram flow — apply 5 commands including at least one `ADD_NODE`, one `RENAME_NODE`, and one `SET_STYLE`.
- [ ] Deliberately upload a nonsense transcript (song lyrics). Pass 1 should filter everything → Pass 2 should return empty arrays → modal should show "No proposed changes" instead of crashing.
- [ ] Deliberately kill the OpenAI API key mid-run. Verify transcript row moves to `status='failed'` with `error_message` populated, and the UI shows a retry button.
- [ ] Upload a 15k-word transcript. Should complete without Vercel timeout thanks to SSE.

---

## Step 12 — Post-launch (nice to have, don't block MVP)

- [ ] Token usage tracking column on `meeting_transcripts`.
- [ ] Retry button on failed transcripts.
- [ ] Export TODOs as `.md` checklist from history page.
- [ ] Redact PII in `raw_text` before persisting (email addresses, phone numbers).

---

## Failure log (fill in as you build)

Format each entry as:
```
### <date>: <one-line summary>
**What I tried:** ...
**Why it failed:** ...
**What worked instead:** ...
```

<!-- Entries start here -->

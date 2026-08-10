# Meeting Transcript → Diagram — Technical Guide

> Living document. Update the **Change log** at the bottom every time you touch
> the feature — including when an approach is rejected, so the next engineer
> (or LLM) doesn't re-litigate a solved problem.

---

## 1. What this feature does

A user pastes (or uploads) a meeting transcript and gets one of two outcomes:

| Mode | Trigger | Output |
|------|---------|--------|
| `new_diagram` | Homepage "Start with Transcript" card | Proposed L0→L3 capability tree with checkbox-per-node. Approved tree becomes a brand-new `capability_catalog`. |
| `edit_diagram` | RightSidebar "From transcript" button on the canvas | `{ summary, todos[], commands[] }` against the currently open diagram. Approved commands run through `executeCommands()`; approved TODOs attach as node notes when a target is identified, otherwise surface on the transcript history page. |

Both modes drive the **same review modal** — only the tab set differs.

---

## 2. Pipeline

```
Client uploads text (paste / .txt / .docx / .vtt)
    │
    ▼
POST /api/transcripts          → creates meeting_transcripts row, returns { id }
    │
    ▼
GET  /api/transcripts/:id/stream  (Server-Sent Events)
    │
    ├──  5%   Parse file → plain text        (parseVtt.ts / parseDocx.ts / passthrough)
    ├── 15%   Clean regex noise              (clean.ts)
    ├── 30%   Pass 1: Relevance filter LLM   (pass1-filter.ts)
    ├── 55%   Pass 2: Structural extraction  (pass2-extract.ts — mode-aware)
    ├── 80%   Pass 3: TODOs + summary        (pass3-todos.ts)
    ├── 95%   Resolve fuzzy names            (resolve.ts)
    └── 100%  Persist transcript_proposals   → status='ready_for_review'
    │
    ▼
Review modal opens, user toggles checkboxes, edits inline
    │
    ▼
POST /api/transcripts/:id/apply
    │
    ├── mode='new_diagram'  → applyNew.ts   (create catalog + capabilities)
    └── mode='edit_diagram' → applyEdit.ts  (executeCommands + persist patches)
    │
    ▼
Append commit entry to capability_catalogs.chat_history.commits[]
Redirect to /dashboard?catalogId=…
```

**Why 3 passes instead of 1?**  See §5 "Rejected approaches — A. Single-pass extraction".

---

## 3. Database

Migration file: [scripts/migrations/2026-08-03_meeting_transcripts.sql](scripts/migrations/2026-08-03_meeting_transcripts.sql)

Purely additive — no changes to `capability_catalogs`, `capabilities`, `visual_maps`, or `clients`.

### `meeting_transcripts`
Stores raw + cleaned text, meeting metadata, pipeline state, AI summary.

Status lifecycle:
```
uploaded → parsing → cleaning → filtering → extracting → resolving
        → ready_for_review → applying → completed
                                     └─→ failed
```

### `transcript_proposals`
Discriminated by `kind`:

| kind | payload shape | applies to |
|------|--------------|------------|
| `node` | `{ tempId, parentTempId, level, name, description }` | `new_diagram` mode |
| `command` | `DiagramCommand` (see [src/lib/commands/index.ts](src/lib/commands/index.ts)) | `edit_diagram` mode |
| `todo` | `{ text, targetNodeId?, priority, owner?, sourceQuote }` | both modes |

`selected` reflects the user's checkbox state. `status` moves `pending → accepted/declined → applied/failed`.

---

## 4. Files & responsibilities

### API routes
| File | Method | Purpose |
|------|--------|---------|
| `src/app/api/transcripts/route.ts` | GET | List current user's transcripts (paginated) |
| `src/app/api/transcripts/route.ts` | POST | Create transcript row, return `{ id }` |
| `src/app/api/transcripts/[id]/route.ts` | GET | Fetch transcript + proposals |
| `src/app/api/transcripts/[id]/stream/route.ts` | GET | SSE — runs pipeline, streams progress |
| `src/app/api/transcripts/[id]/proposals/route.ts` | PATCH | Toggle `selected` on multiple rows |
| `src/app/api/transcripts/[id]/apply/route.ts` | POST | Execute accepted proposals |

### Library modules (`src/lib/transcript/`)
| File | Responsibility |
|------|----------------|
| `parseVtt.ts` | WebVTT (Teams/Zoom native export) → plain text |
| `parseDocx.ts` | `.docx` → plain text via `mammoth` |
| `clean.ts` | Regex noise-scrubber (timestamps, speakers, fillers, dedup) |
| `pipeline.ts` | Orchestrates the 3 passes, emits SSE progress |
| `pass1-filter.ts` | LLM call — keep only capability/action-relevant paragraphs |
| `pass2-extract.ts` | LLM call — mode-aware structural extraction |
| `pass3-todos.ts` | LLM call — TODO extraction + meeting summary |
| `resolve.ts` | Fuzzy match proposed capability names against existing tree |
| `applyNew.ts` | Create `capability_catalog` + `capabilities` rows |
| `applyEdit.ts` | Convert `command` proposals → `DiagramCommand[]` → `executeCommands()` |

### UI components
| File | Purpose |
|------|---------|
| `src/app/(routes)/transcripts/page.tsx` | History list + "New transcript" launcher |
| `src/components/transcript/TranscriptUpload.tsx` | Paste box + drag-drop upload |
| `src/components/transcript/TranscriptReviewModal.tsx` | Shared review modal with mode-dynamic tabs |
| `src/components/transcript/ProgressBar.tsx` | SSE-driven pipeline progress |

### Modified files
| File | Change |
|------|--------|
| [src/components/ui/EntryCards.tsx](src/components/ui/EntryCards.tsx) | Add "Start with Transcript" card, grid `sm:grid-cols-3` |
| [src/components/canvas/RightSidebar.tsx](src/components/canvas/RightSidebar.tsx) | "From transcript" button that opens the modal in `edit_diagram` mode |
| `package.json` | Add `mammoth` for .docx parsing |

---

## 5. Rejected approaches (with reasons)

### A. Single-pass LLM extraction
**What:** One LLM call with system prompt covering structural + category + TODO extraction. Prompt returns everything as one JSON blob.

**Why rejected:**
- Accuracy degrades on transcripts >8k words — the model conflates action items with structural changes, or drops one category entirely.
- One giant prompt is hard to tune: fixing over-extraction of TODOs hurts structural recall.
- User priority is accuracy over latency, so we accept the extra 6–10s from three passes.

**When to reconsider:** if usage shows 95%+ of transcripts are <3k words, collapse Pass 2 + Pass 3 into a single call to save cost.

---

### B. Blocking POST (no SSE, no progress bar)
**What:** `POST /api/transcripts` waits for the LLM chain and returns proposals in the response body.

**Why rejected:**
- Vercel serverless timeout (10s Hobby, 60s Pro) will kill any 3-pass run on a 15k-word transcript.
- No progress feedback → users think the app is frozen for 15–30s.
- Even on Pro, silent 30s waits are UX-hostile.

**Chosen instead:** `POST` returns `{ id }` immediately; client opens SSE stream to `/api/transcripts/:id/stream` which runs the pipeline and emits `progress` events.

---

### C. Embedding-based semantic matching (Approach C from [TRANSCRIPT_FEATURE_ALTERNATIVES.md](TRANSCRIPT_FEATURE_ALTERNATIVES.md))
**What:** Embed transcript sentences, cosine-match against embedded capability names, then LLM-classify matched pairs.

**Why rejected:**
- Completely breaks for `new_diagram` mode — there's no existing tree to embed against.
- Extra embedding API cost + latency for questionable gain on our typical tree sizes (<200 capabilities).
- Fuzzy string match (Levenshtein + normalized tokens) in `resolve.ts` handles name matching well enough for our tree sizes.

**Where we still use embeddings:** nowhere in the transcript feature. Existing `/api/embeddings` route remains untouched.

---

### D. Agent-based multi-turn extraction (Approach E)
**What:** LLM agent loops over the transcript, self-reflects, iteratively builds the change list.

**Why rejected:**
- 5–10 LLM calls per transcript → $0.04+ per run (vs $0.015 for 3-pass).
- 20–40s latency even with cached prompts.
- Self-reflection loops are hard to debug when the agent produces a bad output.
- Human review at the end already catches errors — no need to make the AI self-correct.

---

### E. Auto-apply high-confidence changes without review
**What:** Skip the review modal for proposals with confidence ≥ 0.9; auto-execute.

**Why rejected:**
- User explicitly chose "always require multi-select review before applying" (safest).
- Auto-apply is an irreversible mutation on user data. Even at 90% confidence, one wrong destructive command per 10 runs is unacceptable.

---

### F. Store TODOs as a separate `catalog_todos` table
**What:** New table dedicated to TODOs, joined to catalogs.

**Why rejected:**
- Adds schema complexity for what is mostly transient meeting-follow-up data.
- TODOs that reference a node fit naturally into the existing `capabilities.note` column via the existing `SET_NOTE` command — no schema change needed.
- Un-linked TODOs live on `meeting_transcripts` rows and surface in the transcript history page — good enough.

**When to reconsider:** if TODOs become a first-class object (assignment, due dates, cross-catalog aggregation, notifications).

---

### G. Client-side file parsing for `.docx`
**What:** Parse `.docx` in the browser with `docx-preview` or `mammoth.js`.

**Why rejected:**
- Bloats the client bundle by ~500 KB for a rarely-used path.
- We already have Node runtime on the API side; `mammoth` runs there fine.

**Chosen:** upload `.docx` bytes to the API; server calls `mammoth.extractRawText()`.

---

### H. VTT parsing via a library
**What:** Add a dep like `webvtt-parser`.

**Why rejected:**
- Overkill — VTT is line-based; ~30 lines of regex handle Teams/Zoom exports.
- Fewer supply-chain risks.

**Chosen:** hand-rolled `parseVtt.ts`.

---

## 6. Prompt design notes

### Pass 1 — Relevance filter
- System prompt is intentionally short: "Keep only paragraphs that discuss business capabilities, processes, tools, systems, roles, or action items. Drop small-talk, admin, tangents."
- Input: cleaned transcript.
- Output: same-format transcript with irrelevant paragraphs removed (not JSON).
- Model: `gpt-4.1-mini`.

### Pass 2 — Structural extraction
- Two flavours by mode.
- `edit_diagram` prompt receives: filtered text + existing tree (as YAML for token efficiency) + node_styles + legend.
- Output: strict JSON matching one of two schemas. Include `confidence` (0–1) and `sourceQuote` for every proposal.
- Model: `gpt-4.1-mini`.

### Pass 3 — TODOs + summary
- Input: filtered text + summary of Pass 2's proposals (so TODOs can reference proposed nodes).
- Output: `{ summary: string, todos: Array<{ text, targetName?, priority, owner?, sourceQuote }> }`.
- Model: `gpt-4.1-mini`.

**JSON discipline:** all three passes use `response_format: { type: "json_object" }` on OpenAI. On parse failure, retry once with a stricter reminder. Second failure → mark transcript `failed`, show user the raw model output for manual re-run.

---

## 7. Noise-scrubbing rules (`clean.ts`)

Applied before Pass 1 to shrink token count and improve signal:

| Rule | Regex / method |
|------|----------------|
| Drop timestamp lines | `^\s*\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*$` |
| Drop bracketed stage direction | `^\s*\[.*\]\s*$` |
| Strip inline timestamps | `\s*\(\d{1,2}:\d{2}(:\d{2})?\)\s*` |
| Strip speaker prefixes | `^(Speaker \d+|[A-Z][a-z]+ [A-Z][a-z]+):\s*` |
| Collapse fillers | `\b(um|uh|you know|like|sort of|kind of)\b\s*` (mid-sentence only) |
| Drop lines under 3 tokens post-clean | `line.split(/\s+/).filter(Boolean).length < 3` |
| Merge consecutive same-speaker lines | Track prev-speaker; concat with space |
| Dedup near-identical sentences | Normalized string equality (lowercase, punctuation-stripped) |

Keep a `originalLineNumbers[]` map on cleaned lines so `sourceQuote` can point back to raw text for the review modal.

---

## 8. Known limitations & future work

- **No audio input.** By design — text only. If added later, transcribe via Whisper first, then feed into the same pipeline.
- **Cross-transcript memory.** Each transcript is processed in isolation. If a later meeting says "as we discussed last week", we don't cross-reference the previous transcript. Future: pass recent commit summaries as context.
- **Language.** English-only prompts. i18n needs new system prompts per language.
- **Cost visibility.** No per-transcript cost tracking yet. Add a `token_usage` column on `meeting_transcripts` if usage grows.

---

## 9. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-08-03 | Initial version. Three-pass pipeline, SSE progress, shared review modal for both modes. Rejected approaches A–H documented. | Planning session |

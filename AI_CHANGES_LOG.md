# AI Feature — Change Log

Each entry records what was changed and which file was affected.

---

## 2026-08-04 — Transcript Enhancement Sprint (6 fixes)

### Fix 1 — Modal portal
**File:** `src/components/transcript/TranscriptReviewModal.tsx`
Added `createPortal(modalContent, document.body)` so the modal escapes `overflow-hidden` parent containers (AI editor sidebar, RightSidebar). Also added dynamic tab logic — tabs are derived from which proposal kinds actually exist rather than hardcoded by mode.

### Fix 2 — Context prompt
**Files:** `src/components/transcript/TranscriptUpload.tsx`, `src/app/api/transcripts/route.ts`, `src/lib/transcript/pipeline.ts`, `src/lib/transcript/pass1-filter.ts`, `src/lib/transcript/pass2-extract.ts`, `src/lib/transcript/pass3-todos.ts`, `src/types/transcript.ts`
Added a free-text "Context & specifications" textarea to the upload form. The value is stored in `meeting_transcripts.context_prompt` and threaded through all three LLM passes as an extra system prompt section. Enables speaker-role rules, color-coding instructions, and priority attribution.

### Fix 3 — Template selection
**Files:** `src/components/transcript/TranscriptUpload.tsx`, `src/app/api/transcripts/route.ts`, `src/lib/transcript/pipeline.ts`, `src/lib/transcript/applyNew.ts`
In `new_diagram` mode, a template dropdown fetches from `/api/catalogs/templates`. When a template is selected: pipeline loads the template capabilities and runs edit-mode extraction → proposals are `command` kind. `applyNew` detects `template_id`, clones the template catalog (`applyNewFromTemplate`), then applies accepted commands.

### Fix 4 — Change tracking notes
**Files:** `src/lib/transcript/applyEdit.ts`, `src/lib/transcript/applyNew.ts`
Every `ADD_NODE` from a transcript apply stamps `"Added via transcript 'X' on MM/DD/YYYY"` on the new node's `note`. Renamed/reparented nodes get `"Modified via transcript …"`. Pure new-diagram nodes (no template) get `"Created via transcript …"`.

### Fix 5 — Catalog-level notes
**Files:** `src/app/api/catalogs/[id]/notes/route.ts` (new), `src/components/canvas/CatalogNotesPanel.tsx` (new), `src/app/(routes)/dashboard/page.tsx`
New `GET/PATCH /api/catalogs/[id]/notes` endpoint reads/writes `capability_catalogs.notes`. `CatalogNotesPanel` is a portal modal with auto-save on blur. A "Notes" toolbar button (pencil icon) is added to the dashboard header, visible whenever a diagram is loaded.

---


**File:** `src/app/(routes)/dashboard/page.tsx`
The nested `setNodeStyles`-inside-`setCapabilities` pattern was returning stale state. Flattened it so `executeCommands` runs once, then `setNodeStyles` and `setCapabilities` are each set from the single result, and the Zustand store is updated with `result.capabilities`.

---

## Task 2 — Add `ADD_NODE` and `SET_DESCRIPTION` command types
**File:** `src/lib/commands/index.ts`
Added `ADD_NODE` (with `tempId`, `parentId`, `level`, `name`, `description`, `insertAfterId`) and `SET_DESCRIPTION` (with `nodeId`, `description`) to the `DiagramCommand` union. Also added `description?: string` to `NodeStylePatch` so the right sidebar can receive description updates via node patches.

---

## Task 4 — Update `promptBuilder` docs and tree render
**File:** `src/lib/commands/promptBuilder.ts`
Added command entries 6 (`ADD_NODE`) and 7 (`SET_DESCRIPTION`) to the system prompt with level rules and UUID format guidance. Added a rule bullet reminding the LLM to generate a valid UUID v4 for `tempId`. Updated `renderTree()` to append `desc:"..."` to each node line so the AI can read current descriptions before deciding what to change.

---

## Tasks 5 & 6 — AIPanel / Dashboard wiring (already existed)
**Files:** `src/components/canvas/RightSidebar.tsx`, `src/app/(routes)/dashboard/page.tsx`
The RightSidebar already has a full "AI chat" tab with `handleSend` that calls `/api/transform` and fires `onAICommands`. The dashboard already passes `onAICommands={applyAICommands}` to the sidebar. No new code needed — these tasks are completed as-is.

---

## Task 8 — Switch to Gemini + add request/response logging
**File:** `src/app/api/transform/route.ts`, `.env.local`
Switched provider from Groq to Gemini (`gemini-2.0-flash`) using the same `openai` SDK with Gemini's OpenAI-compatible `baseURL`. Added `console.log` blocks that print to the dev server terminal on every request: incoming prompt + capability count, raw JSON response from Gemini, parsed commands list, and any errors. `GEMINI_API_KEY` added as blank placeholder in `.env.local`.

---

**Files:** `src/app/api/transform/route.ts`, `.env.local`
Replaced OpenAI (`gpt-4.1-mini`) with Groq's free OpenAI-compatible API (`llama-3.3-70b-versatile`). No new package needed — the existing `openai` SDK works with Groq by setting `baseURL` to `https://api.groq.com/openai/v1`. Added `GROQ_API_KEY=` (blank placeholder) to `.env.local`. Get a free key at https://console.groq.com — no credit card required.
## Task 3 — Implement `ADD_NODE` and `SET_DESCRIPTION` in executor
**File:** `src/lib/commands/executor.ts`
`ADD_NODE`: validates parent exists and level hierarchy, computes `sort_order` (respects `insertAfterId` and shifts siblings), then pushes a full `Capability` object with `source: "ai_generated"`.
`SET_DESCRIPTION`: updates `description` on the capability in the tree and emits a `nodePatches` entry so the right sidebar re-renders.

---


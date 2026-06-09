# AI Feature — Change Log

Each entry records what was changed and which file was affected.

---

## Task 1 — Fix `applyAICommands` bug
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


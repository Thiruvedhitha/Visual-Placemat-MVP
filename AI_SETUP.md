# AI Integration Setup — Visual Placemat

This document covers the complete design for the AI-powered diagram editing system:
what is already built, what gaps remain, and exactly how every piece wires together.

---

## 1. The Core Security Model (Non-Negotiable)

```
User types prompt
      ↓
/api/transform  ←  AI lives HERE (server-side only)
      ↓
Array of DiagramCommands (JSON)
      ↓
executeCommands() — runs in LOCAL memory (Zustand + ReactFlow)
      ↓
User sees preview on canvas — NO DB write yet
      ↓
User clicks "Apply"
      ↓
/api/catalogs/save — Supabase bulk upsert
```

**The AI never touches the database.** It only returns a list of commands (plain JSON).
The executor applies them to in-memory state. The existing "Apply" button in the header
already does the DB flush. This means:
- Malformed AI output cannot corrupt data (commands are validated in executor.ts)
- Users can review all changes before committing
- Every DB write is a deliberate human action

---

## 2. What Is Already Built

### 2a. Command System (`src/lib/commands/`)

| Command | What it does | Status |
|---|---|---|
| `SET_STYLE` | Change fill / border colour of a node | ✅ Built |
| `SET_NOTE` | Add / replace text note on a node | ✅ Built |
| `RENAME_NODE` | Rename a capability | ✅ Built |
| `REPARENT_NODE` | Move a node to a different parent | ✅ Built |
| `DELETE_NODE` | Delete a node (cascade or lift children) | ✅ Built |
| `ADD_NODE` | Create a new capability | ❌ Missing |
| `SET_DESCRIPTION` | Update the description field | ❌ Missing |

### 2b. API Route (`/api/transform`)

- Already calls **Claude claude-opus-4-5** via `@anthropic-ai/sdk`
- Accepts `{ prompt, capabilities, nodeStyles }` in the POST body
- Returns `{ commands: DiagramCommand[], summary: string }`
- `promptBuilder.ts` renders the full capability tree (with IDs, levels, current styles)
  as context for the LLM — the AI always knows what's on the canvas

### 2c. Dashboard (`/dashboard`)

- `applyAICommands()` callback exists and is ready — it calls `executeCommands()`,
  updates Zustand + local state, and marks the store dirty so "Apply" lights up
- The Zustand store persists locally (localStorage via `persist`) so edits survive page refreshes
- "Apply" button already calls `/api/catalogs/save` which does a Supabase bulk upsert

### 2d. Database Schema

Tables that support AI features (already in schema.sql):

| Table | Purpose |
|---|---|
| `capability_chunks` | Vector-embedded capability names/descriptions for RAG |
| `diff_history` | Log of every AI prompt and the commands it produced |
| `prompt_sessions` | Per-prompt metadata (model, latency, errors) |

pgvector extension is enabled — ready for similarity search.

---

## 3. What Needs to Be Built

### 3a. Missing Commands

#### ADD_NODE

```ts
// Add to src/lib/commands/index.ts
| {
    type: "ADD_NODE";
    /** UUID to assign — generate client-side with crypto.randomUUID() */
    tempId: string;
    parentId: string | null;
    level: 0 | 1 | 2 | 3;
    name: string;
    description?: string;
    /** Insert after this sibling's sort_order; null = append */
    insertAfterId?: string | null;
  }
```

Executor logic: generate a new Capability object with `source: "ai_generated"`,
assign sort_order after the target sibling, push into the capabilities array.

#### SET_DESCRIPTION

```ts
| {
    type: "SET_DESCRIPTION";
    nodeId: string;
    description: string;
  }
```

Executor logic: update `cap.description` in the capabilities array. Also update
the right sidebar display (it reads from `node.data.description`).

---

### 3b. AI Prompt Panel (Dashboard UI)

A collapsible panel docked to the **bottom** of the canvas area (above the footer).
It should not overlap the right sidebar.

**State needed in `DashboardContent`:**
```ts
const [aiPrompt, setAiPrompt] = useState("");
const [aiLoading, setAiLoading] = useState(false);
const [aiSummary, setAiSummary] = useState<string | null>(null);
const [aiError, setAiError] = useState<string | null>(null);
const [isPanelOpen, setIsPanelOpen] = useState(false);
```

**Submit handler:**
```ts
const handleAISubmit = async () => {
  if (!aiPrompt.trim() || aiLoading) return;
  setAiLoading(true);
  setAiError(null);
  setAiSummary(null);
  try {
    const res = await fetch("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiPrompt, capabilities, nodeStyles }),
    });
    const data = await res.json();
    if (!res.ok) { setAiError(data.error); return; }
    applyAICommands(data.commands);        // applies locally — no DB write
    setAiSummary(data.summary);
    setAiPrompt("");
    // "Apply" button in header is now lit up — user decides when to save
  } catch {
    setAiError("Network error");
  } finally {
    setAiLoading(false);
  }
};
```

**Panel component placement:** Rendered inside the canvas wrapper `<div>` as an
`absolute bottom-0 left-0 right-0` overlay panel (above the canvas, not blocking it
when collapsed to just a toolbar strip).

**Prompt examples to show users:**
- "Make all L0 nodes dark blue with white text"
- "Rename 'Finance' to 'Financial Services'"
- "Add a new L1 capability called 'AI & Automation' under 'Technology'"
- "Delete the 'Legacy Systems' branch and move its children up"
- "Add a note to 'Customer Experience' saying it needs review"

---

### 3c. Context-Aware Suggestions (RAG)

This is how the AI knows about previous diagrams and other client maps.

#### How it works

```
User opens a diagram for "AMEX"
        ↓
Before calling /api/transform, fetch similar capability chunks:
  POST /api/embeddings/search
  { query: userPrompt, catalogId, clientName: "AMEX", limit: 10 }
        ↓
Returns top-10 similar capability names from:
  - Other AMEX diagrams (client_name = "AMEX")
  - Same industry diagrams (industry = "Banking")
  - Global template library
        ↓
Inject these into the system prompt as "Reference capabilities from similar diagrams:"
        ↓
Claude uses this context when suggesting ADD_NODE names
```

#### What needs to be built

**1. Embed capabilities on save** — in `/api/catalogs/save`, after inserting capabilities,
also insert rows into `capability_chunks`:

```ts
// For each capability inserted:
const embedding = await getEmbedding(cap.name + " " + (cap.description ?? ""));
await supabase.from("capability_chunks").upsert({
  id: cap.id,
  label: cap.name,
  level: String(cap.level),
  industry: catalog.industry ?? "",
  content: cap.description ?? cap.name,
  embedding,                    // float[] from text-embedding-3-small
  source: "client_map",
  source_catalog_id: catalogId,
});
```

**2. Implement `/api/embeddings`** — currently returns 501. Needs two endpoints:

`POST /api/embeddings/search` — takes `{ query, clientName?, industry?, limit }`,
returns similar chunks using pgvector `<->` cosine similarity.

```sql
SELECT id, label, level, content, source_catalog_id,
       1 - (embedding <-> $1::vector) AS similarity
FROM capability_chunks
WHERE ($2::text IS NULL OR source_catalog_id IN (
  SELECT id FROM capability_catalogs WHERE client_name = $2
))
ORDER BY embedding <-> $1::vector
LIMIT $3;
```

`POST /api/embeddings/index` — called by the save pipeline to upsert chunks.

**3. Update `/api/transform`** to accept and inject `contextChunks`:

```ts
// In promptBuilder.ts, add a section:
if (contextChunks.length > 0) {
  prompt += `\n\n## Reference Capabilities from Similar Diagrams\n`;
  prompt += `When suggesting new capabilities, prefer names from this list:\n`;
  prompt += contextChunks.map(c => `- [L${c.level}] ${c.label}`).join("\n");
}
```

**4. Update `TransformRequest` type:**

```ts
export interface TransformRequest {
  prompt: string;
  capabilities: Capability[];
  nodeStyles?: Record<string, NodeStylePatch>;
  contextChunks?: { label: string; level: string }[];  // add this
}
```

---

### 3d. Diff History Logging

Every AI interaction should be logged to `diff_history`. This gives you:
- Full audit trail per catalog
- Ability to undo/rollback later
- Usage analytics

In `/api/transform`, after getting commands back from Claude, before returning:

```ts
await supabase.from("diff_history").insert({
  catalog_id: body.catalogId,
  prompt_text: prompt,
  diff_payload: parsed.commands,
  status: "applied",
  model_used: "claude-opus-4-5",
});
```

This requires passing `catalogId` in the transform request body.

---

## 4. Full End-to-End Flow (Wired)

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD (browser)                                        │
│                                                             │
│  1. Canvas shows current diagram (from Zustand / DB)        │
│                                                             │
│  2. User types in AI panel:                                 │
│     "Add Risk Management under Compliance, L2"              │
│                                                             │
│  3. handleAISubmit():                                       │
│     a. (optional) fetch /api/embeddings/search              │
│        → top-10 similar caps from AMEX's other diagrams     │
│     b. POST /api/transform {                                │
│          prompt, capabilities, nodeStyles, contextChunks    │
│        }                                                    │
│                                                             │
│  4. Server (/api/transform):                                │
│     a. buildCommandPrompt() — renders tree + context        │
│     b. Calls Anthropic API                                  │
│     c. Parses JSON response                                 │
│     d. Logs to diff_history                                 │
│     e. Returns { commands, summary }                        │
│                                                             │
│  5. applyAICommands(commands):                              │
│     a. executeCommands() validates + applies each command   │
│     b. Updates capabilities[] in local state                │
│     c. Updates nodeStyles{} for visual changes              │
│     d. Zustand store.isDirty = true                         │
│     e. Canvas re-renders — user sees the change             │
│     f. Summary toast: "Added Risk Management under Compliance"│
│                                                             │
│  6. User reviews — can undo (not yet built) or edit further │
│                                                             │
│  7. User clicks "Apply" (green button, header):             │
│     POST /api/catalogs/save {                               │
│       catalogId, catalogName, capabilities                  │
│     }                                                       │
│     → Supabase bulk upsert                                  │
│     → Also indexes new capabilities into capability_chunks  │
│     → isDirty = false, button shows "Saved"                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Full List of AI Capabilities After This Setup

| Use Case | How | Commands used |
|---|---|---|
| Change node colours | "Make all L0 nodes navy blue" | SET_STYLE |
| Rename nodes | "Rename Finance to Financial Services" | RENAME_NODE |
| Add notes | "Add a note to HR saying it's under review" | SET_NOTE |
| Update descriptions | "Update description of IT to include cloud" | SET_DESCRIPTION |
| Delete nodes | "Remove the Legacy Systems branch" | DELETE_NODE |
| Delete and preserve children | "Remove the wrapper but keep its children" | DELETE_NODE (reparentChildren: true) |
| Move nodes | "Move Security under Technology instead of Operations" | REPARENT_NODE |
| Add nodes | "Add a new capability called AI & Automation under Technology L1" | ADD_NODE |
| Bulk restyle | "Highlight all capabilities that contain 'Data' in yellow" | SET_STYLE (multiple) |
| Client-aware suggestions | Prompt: "Suggest missing capabilities for a banking client" | ADD_NODE (RAG-informed names) |
| Cross-diagram context | AI references other AMEX diagrams when suggesting new caps | Embedding search before transform |

---

## 6. Implementation Order (Recommended)

### Phase 1 — Wire the AI panel (1–2 days)
1. Add the AI prompt panel component to the dashboard
2. Call `/api/transform` from the panel
3. Pipe result into existing `applyAICommands()` — this alone covers rename, style, note, delete, reparent

### Phase 2 — Add missing commands (half day)
1. Add `ADD_NODE` to `index.ts`, `executor.ts`, and `promptBuilder.ts`
2. Add `SET_DESCRIPTION` to all three files
3. Test: "Add a new capability called X under Y"

### Phase 3 — Diff history logging (half day)
1. Pass `catalogId` in transform request
2. Log to `diff_history` in `/api/transform`
3. This unlocks future "history" and "undo" panels

### Phase 4 — Context-aware suggestions (2–3 days)
1. Implement `/api/embeddings/index` (embed on save)
2. Implement `/api/embeddings/search` (pgvector cosine search)
3. Pre-fetch context in the dashboard before calling transform
4. Update `promptBuilder.ts` to inject context chunks
5. Test: open AMEX catalog → prompt AI → AI references other AMEX diagrams

### Phase 5 — Undo stack (future)
- Since every AI action first lives in local state, you can keep a history of capability
  snapshots and roll back to previous snapshots before clicking Apply.

---

## 7. Environment Variables Required

```env
# Already needed
ANTHROPIC_API_KEY=sk-ant-...

# For embeddings (choose one)
OPENAI_API_KEY=sk-...          # text-embedding-3-small (cheapest)
# OR use Anthropic's own embeddings if you prefer one vendor

# Already configured
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 8. What the AI Cannot Do (By Design)

- **Write directly to the database** — all DB writes require the human "Apply" click
- **Delete a catalog** — no command type exists for catalog-level destruction
- **Access other users' diagrams** — context chunks are filtered by `client_name`/`industry`,
  and RLS on Supabase prevents cross-user data access
- **Run arbitrary code** — the command schema is a strict whitelist; unknown command types
  are silently ignored by the executor
- **Invent node IDs** — the system prompt explicitly says "use only IDs listed below";
  the executor validates every nodeId against the live capabilities array before applying

---

## 9. Files to Create / Modify

| File | Action | What changes |
|---|---|---|
| `src/lib/commands/index.ts` | Modify | Add `ADD_NODE`, `SET_DESCRIPTION` types |
| `src/lib/commands/executor.ts` | Modify | Handle `ADD_NODE`, `SET_DESCRIPTION` cases |
| `src/lib/commands/promptBuilder.ts` | Modify | Add ADD_NODE/SET_DESCRIPTION docs + inject contextChunks |
| `src/app/api/transform/route.ts` | Modify | Accept contextChunks, log to diff_history |
| `src/app/api/embeddings/route.ts` | Replace | Implement /search and /index sub-routes |
| `src/components/canvas/AIPanel.tsx` | **Create** | The prompt input + result display panel |
| `src/app/(routes)/dashboard/page.tsx` | Modify | Mount AIPanel, wire handleAISubmit |
| `src/lib/ai/embeddings/` | **Create** | getEmbedding() helper using OpenAI or Anthropic |


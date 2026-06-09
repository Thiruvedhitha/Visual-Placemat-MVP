# How the AI Works — Visual Placemat

A plain-English walkthrough of every step, from the user typing a message to the canvas updating.

---

## 1. Big Picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser (React / Next.js)                                              │
│                                                                         │
│  ┌──────────────────┐    fetch POST     ┌───────────────────────────┐  │
│  │  AIMapEditor.tsx │ ────────────────► │  /api/transform/route.ts  │  │
│  │  (Chat sidebar)  │ ◄──────────────── │  (Next.js API Route)      │  │
│  └────────┬─────────┘  {commands,       └────────────┬──────────────┘  │
│           │             summary}                     │                  │
│           ▼                                          │ OpenAI-compat    │
│  executeCommands()                                   ▼ SDK              │
│  (executor.ts)                           ┌───────────────────────┐     │
│           │                              │  Google Gemini API    │     │
│           ▼                              │  gemini-2.5-flash     │     │
│  Canvas updates                          └───────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

The AI only does **one thing**: turn natural language into a list of JSON commands. Executing those commands on the canvas is done locally in the browser — no second AI call needed.

---

## 2. Component Map

| File | Role |
|---|---|
| `src/components/canvas/AIMapEditor.tsx` | Chat UI: input box, message bubbles, quick-action buttons, scope toggle |
| `src/app/api/transform/route.ts` | API route: receives the request, calls Gemini, returns commands |
| `src/lib/commands/promptBuilder.ts` | Builds the system prompt (rules + current diagram tree) |
| `src/lib/commands/executor.ts` | Applies returned commands to the in-memory capability array |
| `src/lib/commands/index.ts` | TypeScript types: `DiagramCommand`, `TransformRequest`, `ChatHistoryMessage` |

---

## 3. Step-by-Step Flow

### Step 1 — User types a message

The user types in `AIMapEditor` and presses Enter (or clicks Send).

```
User types: "Rename 'Finance' to 'Financial Services'"
```

The component immediately adds the message to the local `messages` state (displayed in the chat bubble UI) and sets `isLoading = true`.

---

### Step 2 — Scope & Prompt Building

Before sending to the API, the frontend adds a **scope prefix** if the user is in "Single Node" mode:

```
[Scope: single node — "Finance" (L1), under "Enterprise"]

Rename 'Finance' to 'Financial Services'
```

In "Entire Map" mode the prompt is sent as-is.

---

### Step 3 — Chat history is collected

All previous messages in the current session are converted to history turns:

```json
[
  { "role": "user",      "content": "Add a new L2 node under Payments" },
  { "role": "assistant", "content": "Added 'Instant Payments' under Payments." },
  { "role": "user",      "content": "Rename 'Finance' to 'Financial Services'" }
]
```

This gives Gemini full context of the conversation so far.

---

### Step 4 — POST request to `/api/transform`

The frontend sends:

```json
{
  "prompt":       "Rename 'Finance' to 'Financial Services'",
  "capabilities": [ ...all capability nodes from the canvas... ],
  "nodeStyles":   { "<uuid>": { "fill": "#ff0000" } },
  "history":      [ ...previous turns, max 20... ]
}
```

---

### Step 5 — Capability Trimming (token optimisation)

The API route does **not** send the full capability list to Gemini. It runs `trimCapabilities()` first:

```
Full map (e.g. 120 nodes)
        │
        ▼
┌─────────────────────────────────────────────┐
│  trimCapabilities()                          │
│                                             │
│  Always include:  ALL L0 + L1              │
│                                             │
│  Keyword-match user prompt against names   │
│  and descriptions of L2 nodes              │
│                                             │
│  Include: matched L2s + their L3 children  │
│  Fallback (no L2 match): all L2, no L3     │
└─────────────────────────────────────────────┘
        │
        ▼
Trimmed subset (e.g. 30 nodes) → sent to Gemini
```

This keeps token usage low and reduces cost.

---

### Step 6 — System Prompt Assembly (`promptBuilder.ts`)

`buildCommandPrompt()` constructs the message that tells Gemini its rules and shows the current diagram. It has two parts:

**Part A — Command catalogue** (static rules, always the same):

```
You are an AI assistant for editing a capability map diagram.

Reply with ONLY a JSON object:
{ "commands": [...], "summary": "one sentence" }

Command types:
  SET_STYLE    — change fill/border colour
  SET_NOTE     — add a text note
  RENAME_NODE  — rename a node
  REPARENT_NODE — move a node to a new parent
  DELETE_NODE  — delete a node (+ descendants)
  ADD_NODE     — add a new node
  SET_DESCRIPTION — update description text

Rules:
  - Use hex colours only (#rrggbb)
  - Never invent node IDs
  - Level hierarchy: L1 under L0, L2 under L1, L3 under L2
  ...
```

**Part B — Current diagram tree** (dynamic, built from `renderTree()`):

```
L0 | Enterprise | id:abc-001
  L1 | Finance | id:abc-002
    L2 | Payments | id:abc-003
      L3 | Instant Payments | id:abc-004
    L2 | Reporting | id:abc-005 [fill:#ff0000 border:#cc0000]
  L1 | Operations | id:abc-006
    ...
```

Every node's ID and any visual overrides are included so Gemini can reference them precisely.

---

### Step 7 — Gemini API Call

The API route assembles the full message list and sends it to Gemini `gemini-2.5-flash` via Google's OpenAI-compatible endpoint:

```
Messages sent to Gemini:
┌─────────────────────────────────────────────────────────┐
│  role: "system"    → full system prompt (rules + tree)  │
│  role: "user"      → turn 1 from history                │
│  role: "assistant" → turn 1 reply from history          │
│  role: "user"      → turn 2 from history                │
│  role: "assistant" → turn 2 reply from history          │
│  ...               → (up to 20 history turns)           │
│  role: "user"      → CURRENT prompt                     │
└─────────────────────────────────────────────────────────┘
```

Settings used:

| Setting | Value | Why |
|---|---|---|
| `model` | `gemini-2.5-flash` | Fast + cheap |
| `temperature` | `0` | Deterministic, no creative variation |
| `max_tokens` | `8192` | Room for large diagrams |
| `response_format` | `json_object` | Forces pure JSON output |

---

### Step 8 — Rate limit retry

If Gemini returns HTTP 429 (rate limit), the API retries automatically with exponential backoff:

```
Attempt 1 fails (429) → wait  6 seconds → retry
Attempt 2 fails (429) → wait 12 seconds → retry
Attempt 3 fails (429) → wait 24 seconds → retry
Attempt 4 fails       → return error to user
```

---

### Step 9 — JSON Parsing & Salvage

Gemini must return a JSON object like:

```json
{
  "commands": [
    { "type": "RENAME_NODE", "nodeId": "abc-002", "newName": "Financial Services" }
  ],
  "summary": "Renamed 'Finance' to 'Financial Services'."
}
```

If the JSON is truncated (Gemini hit the token limit mid-response), the route runs a **salvage pass**: it extracts every `{...}` block that looks like a valid command and returns partial results with a note in the summary.

---

### Step 10 — Commands returned to browser

The API returns:

```json
{
  "commands": [ { "type": "RENAME_NODE", "nodeId": "abc-002", "newName": "Financial Services" } ],
  "summary":  "Renamed 'Finance' to 'Financial Services'."
}
```

---

### Step 11 — `executeCommands()` applies the changes

Back in the browser, `onAICommands(commands)` is called. This runs `executeCommands()` in `executor.ts` which:

```
DiagramCommand[]
       │
       ├── SET_STYLE      → update nodePatches (visual only, no DB)
       ├── SET_NOTE       → update nodePatches
       ├── RENAME_NODE    → update capabilities[] in memory
       ├── REPARENT_NODE  → call dragDropHandler, update capabilities[]
       ├── DELETE_NODE    → remove from capabilities[] (cascade or lift children)
       ├── ADD_NODE       → push new Capability object into capabilities[]
       └── SET_DESCRIPTION → update capabilities[] description field
```

Each command is validated (e.g. node must exist, level hierarchy must be respected). Errors are collected and logged but do not stop the remaining commands from running.

---

### Step 12 — Canvas re-renders

ReactFlow re-renders the canvas with the updated `capabilities[]` and `nodePatches`. The user sees the change immediately. The AI reply summary appears in the chat bubble.

---

## 4. Scope Modes

The sidebar has two modes, toggled by the **Scope** buttons at the top:

```
┌────────────────┬─────────────────────────────────────────────────────────────┐
│ Entire Map     │ Prompt sent as-is. AI has full diagram context.             │
│                │ Quick-action buttons available (Add, Rename, Modify, Delete)│
├────────────────┼─────────────────────────────────────────────────────────────┤
│ Single Node    │ User must click a node on canvas first.                     │
│                │ Prompt is prefixed: [Scope: single node — "Name" (L1)]      │
│                │ AI still has full diagram but knows the focal node.         │
└────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 5. What the AI can and cannot do

### Can do (via commands)

| Command | Effect |
|---|---|
| `SET_STYLE` | Change fill colour, border colour of any node |
| `SET_NOTE` | Attach a text note to any node |
| `RENAME_NODE` | Rename any node |
| `REPARENT_NODE` | Move a node to a different parent (hierarchy rules enforced) |
| `DELETE_NODE` | Delete a node — cascade deletes all children, or lift children to parent |
| `ADD_NODE` | Add a new capability node at any level |
| `SET_DESCRIPTION` | Update the description text of any node |

### Cannot do

- Save to database (commands are applied in-memory only; separate save flow handles persistence)
- Access nodes outside the current catalog
- Break the L0 → L1 → L2 → L3 level hierarchy

---

## 6. Data flow diagram (full)

```
User input
    │
    ▼
AIMapEditor.tsx
    │  buildPrompt()  — adds [Scope: ...] prefix if in node mode
    │  history        — previous messages in this chat session
    │
    ▼
POST /api/transform
    │
    ├── trimCapabilities()
    │       Keyword-filter L2/L3 to reduce tokens
    │
    ├── buildCommandPrompt()
    │       System rules + indented diagram tree with IDs
    │
    ├── Gemini API  (gemini-2.5-flash, temp=0, json_object)
    │       [system] + [history...] + [user]
    │       ↳ retry up to 3× on 429
    │
    ├── JSON.parse()
    │       ↳ salvage pass on truncated responses
    │
    └── return { commands[], summary }
            │
            ▼
    AIMapEditor.tsx
            │  onAICommands(commands)
            │  setMessages([...ai reply bubble])
            │
            ▼
    executeCommands()  (executor.ts)
            │
            ├── Validate each command
            ├── Apply structural changes → capabilities[]
            └── Apply visual changes    → nodePatches{}
                    │
                    ▼
            ReactFlow canvas re-renders
```

---

## 7. Environment variable required

| Variable | Where | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `.env.local` (server-side only) | Authenticates requests to the Google Gemini API |

The key is **never** exposed to the browser. It is read only inside the API route on the server.

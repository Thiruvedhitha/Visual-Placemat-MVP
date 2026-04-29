# CapMap — MVP Feature Specification

> **MVP answers one question:** Can a consultant upload a capability catalog spreadsheet, visualize it as an interactive map, edit it manually or with AI, and export a client-ready PNG — all without signing in?

---

## MVP Scope Summary

| Included | Not Included (v2+) |
|----------|-------------------|
| Upload Excel (.xlsx/.csv) | Sign up / Sign in / Auth |
| Parse L0–L3 capability hierarchy | Multi-user collaboration |
| Visualize as interactive canvas | SLM routing (Phi-3/Llama) |
| Manual edit (drag, rename, add, remove) | Graph DB (Neo4j) |
| AI edit via natural language prompts | Cross-session undo |
| Preview Panel (approve/cancel AI changes) | Admin dashboard |
| In-session undo/redo (Ctrl+Z/Y) | Notifications |
| Export as PNG | PPTX/SVG/PDF export |
| Save to database on "Apply" | Real-time collaboration |
| Data isolated per browser session | Organisation accounts |

---

## 1. No Authentication in MVP

- **No sign up, no sign in, no passwords.**
- The app is open — any user who opens the URL can start working immediately.
- Each user's data is isolated by a **session ID** generated on first visit and stored in the browser (`localStorage`).
- One user cannot see or access another user's catalogs.
- Session ID persists across page refreshes and browser restarts (same browser only).

> **v2 addition:** Email + password auth, Google OAuth, SSO via Supabase Auth. The `user_id` column already exists in the schema — just needs to be wired to Supabase Auth.

---

## 2. Catalog Management

### 2.1 Create a Catalog
- User creates a catalog by uploading an Excel file.
- Optionally provides: client name, catalog name, industry (Banking, Healthcare, Retail, etc.).
- Industry is passed to the AI pipeline as context for smarter suggestions.

### 2.2 List Catalogs
- Dashboard shows all catalogs belonging to the current session.
- Each catalog card shows: name, industry tag, node count, last updated.
- **Data isolation:** Catalogs are scoped to the session ID — no user can see another user's catalogs.

### 2.3 Archive a Catalog
- User can archive a catalog (hides it from the dashboard).
- No hard delete — archived catalogs can be restored.

---

## 3. Spreadsheet Upload and Parsing

### 3.1 File Upload
- User uploads an `.xlsx` or `.csv` file via drag-drop or file picker.
- File is parsed **entirely in the browser** — no file is sent to any server.
- Expected format: columns for L0, L1, L2, L3 capability names + optional description.
- Maximum file size: 5 MB.

### 3.2 Parsing
- SheetJS reads the Excel buffer in the browser.
- Parser finds column headers by regex (`/L0/i`, `/L1/i`, etc.).
- Each row becomes a flat record: `{ l0, l1, l2, l3, description }`.
- Empty cells inherit context from the row above (e.g., if L0 is blank, it belongs to the same L0 as the previous row).
- Parser assigns a temporary UUID and `parent_id` to each node, building the tree.
- Output is pushed to the **Zustand store** (in-memory) — no database call yet.

### 3.3 Validation on Upload
- At least one L0 node must be present.
- No node can skip a level (L2 cannot appear without a parent L1).
- Maximum 500 nodes per upload (canvas performance limit).
- Clear error messages shown if validation fails.

---

## 4. Canvas — Visual Map

### 4.1 Render
- Canvas renders the full L0–L3 hierarchy as an interactive coloured node map.
- Each level has a distinct colour: L0 (dark navy), L1 (blue), L2 (light blue), L3 (pale blue).
- Uses **React Flow** as the rendering engine.

### 4.2 Layout
- Layout engine calculates x,y positions for every node automatically.
- L0 nodes are wide column headers spanning their L1 children.
- L1 nodes form horizontal sub-columns under their L0 parent.
- L2 and L3 nodes stack vertically within each L1 column.
- Layout recalculates after every edit.

### 4.3 Interaction
- **Pan:** Drag the canvas background.
- **Zoom:** Mouse wheel or trackpad pinch.
- **Node click:** Shows node details in the right sidebar (level, parent, description).
- **Layer toggles:** Left sidebar toggles to show/hide L0, L1, L2, L3 independently.

### 4.4 Ghost Preview (AI edits)
- When AI proposes changes, new nodes appear as dashed/faded "ghost" nodes on the canvas.
- Removed nodes appear with reduced opacity and strikethrough.
- Existing nodes do not move during preview — only new nodes get positioned.
- Ghost overlay disappears on Cancel; nodes become solid on Apply.

---

## 5. Manual Editing

### 5.1 Drag & Drop
- User can drag nodes to reposition them on the canvas.
- Position changes are saved in Zustand (in-memory).

### 5.2 Add / Remove / Rename Nodes
- Right-click or use the sidebar to add a new node under a selected parent.
- Delete a node (and optionally its children).
- Rename a node inline.
- All edits happen in Zustand — no database call until "Apply".

---

## 6. AI Prompt Editing

### 6.1 Prompt Input
- Text box accepts natural language instructions (e.g., "Add loyalty program capabilities under Customer Experience").
- Send via Enter key or Send button.
- Loading spinner shown on canvas during AI processing.

### 6.2 Backend Pipeline
1. POST to `/api/prompt` with: prompt text + current nodes + industry context.
2. Embed the prompt (OpenAI `text-embedding-3-small`).
3. Similarity search against `capability_chunks` table (pgvector, filtered by industry, top 5 results).
4. Context Builder assembles: prompt + nodes + RAG chunks + system prompt rules.
5. Claude Sonnet 4 returns a JSON diff array: additions, removals, renames.
6. Diff Normalizer cleans the response (strip markdown fences, resolve IDs).
7. Return clean diff to the frontend.

### 6.3 Validation
- Zod schema check on the diff structure.
- Parent level rule: L1 must point to L0, L2 to L1, L3 to L2.
- Orphan check: every parentId must resolve to an existing node.
- Cycle check: no circular references (DFS).
- On failure: automatic retry (max 2 attempts) with the error message sent back to Claude.
- On total failure: error toast shown, map unchanged.

---

## 7. Preview Panel and Apply

### 7.1 Diff Summary
- Preview Panel shows a colour-coded list of proposed changes:
  - **Green (+)** for additions
  - **Red (−)** for removals
  - **Amber (~)** for renames
- Each row shows: node name, level badge, parent name.

### 7.2 Apply
- "Apply" commits all changes to the Zustand store atomically.
- A snapshot is saved to the undo stack before mutation.
- Saves to Supabase in one transaction:
  - UPSERT `capability_catalogs`
  - Bulk INSERT all `capabilities` (level-by-level for correct parent_id)
  - INSERT new `visual_maps` row (layout as JSON, `is_active = true`)
  - INSERT `diff_history` row (prompt text + diff payload, `status = 'applied'`)
- Canvas re-renders with the new state.

### 7.3 Cancel
- Discards the diff and all ghost nodes.
- Canvas returns to previous state.
- `diff_history` row inserted with `status = 'cancelled'`.

---

## 8. Undo / Redo

### 8.1 In-Session Only
- **Undo (Ctrl+Z):** Restores the previous Zustand snapshot from the history stack.
- **Redo (Ctrl+Y):** Re-applies the most recently undone snapshot.
- Both re-render the canvas immediately.
- Undo stack holds up to 50 snapshots.

### 8.2 Session Boundary
- Undo history lives in Zustand memory — **cleared when the browser tab is closed**.
- The Zustand state itself persists across page **refreshes** via `localStorage` auto-draft.
- Cross-session undo (after closing the browser) is a **v2 feature** using `diff_history` replay.

---

## 9. Auto-Draft (Prevents Data Loss on Refresh)

- Zustand state is auto-saved to `localStorage` every few seconds.
- On page refresh: state is restored from `localStorage` — no data loss.
- On "Apply": draft is cleared (data is now in the database).
- Drafts expire after 7 days.

---

## 10. Export

### 10.1 PNG Export
- Exports the current canvas as a PNG image.
- Uses `html-to-image` library — runs entirely in the browser.
- Download triggered immediately, no server call.

### 10.2 JSON Save / Load (stretch)
- Export: Serialises the current nodes to a `.json` file download.
- Import: Upload a previously exported JSON to restore the map.
- Useful for sharing maps without database access.

---

## 11. Infrastructure

| Component | MVP Choice | Reason |
|-----------|-----------|--------|
| Frontend | Next.js 14 on Vercel | App Router, auto-deploy, edge CDN |
| Database | Supabase (PostgreSQL + pgvector) | Managed, RLS built-in, vector search |
| AI | Claude Sonnet 4 (Anthropic API) | Best structured JSON output |
| Embeddings | text-embedding-3-small (OpenAI) | Fast, 1536 dims, pgvector compatible |
| State | Zustand with persist middleware | Fast, local-first, auto-draft to localStorage |

---

## 12. MVP Database Tables

| Table | Purpose |
|-------|---------|
| `capability_catalogs` | One row per uploaded catalog |
| `capabilities` | All L0–L3 capability nodes |
| `visual_maps` | Layout snapshots (one per version) |
| `diff_history` | Audit log of every AI prompt and its outcome |

> Tables 5–7 (`capability_chunks`, `prompt_sessions`, `catalog_shares`) are created in v2. See `mvp_db.md` for full schema details.

---

## 13. What MVP Deliberately Excludes

| Feature | Why excluded | When added |
|---------|-------------|-----------|
| Sign up / Sign in | Reduces friction for MVP demo | v2 |
| Multi-user collaboration | Not needed for solo consultant | v2 |
| SLM routing (Phi-3/Llama) | Single LLM is simpler to debug | v2 |
| Graph DB (Neo4j) | pgvector alone is sufficient initially | v2 |
| Cross-session undo | In-session undo is sufficient | v2 |
| PPTX / SVG / PDF export | PNG is sufficient for MVP | v2 |
| Admin dashboard | No admin needed until multi-tenant | v3 |
| Notifications | No real-time events in MVP | v3 |
| Mobile layout | Desktop-first for consultants | v3 |

---

## Definition of Done — MVP

- [ ] A user can open the app without signing in
- [ ] A user can upload an `.xlsx` file and see the L0–L3 map on the canvas
- [ ] A user can manually edit the map (drag, add, remove, rename nodes)
- [ ] A user can type a natural language prompt and receive AI-generated changes in the Preview Panel
- [ ] A user can Apply or Cancel the proposed changes
- [ ] Undo and Redo work within the same session (Ctrl+Z / Ctrl+Y)
- [ ] Refreshing the page restores the current state (auto-draft)
- [ ] Clicking "Apply" saves the map to the database
- [ ] A user can export the map as a PNG image
- [ ] All data is isolated per user — no user can access another user's catalogs
- [ ] The application is deployed and accessible via a public URL
# CapMap — MVP Feature Specification

> **Philosophy:** Build the minimum that delivers real value to a consultant in a live engagement. Every architectural decision in the MVP must leave the door open for the complete application — no dead ends, no throwaway code.

---

## MVP Scope Definition

The MVP answers one question: **Can a consultant upload a capability map spreadsheet, edit it using AI prompts, and export a client-ready output — end to end?**

Everything else waits for v2.

---

## 1. Authentication

### 1.1 Email + Password Sign Up / Sign In
- Consultant can create an account with email and password
- Consultant can sign in and sign out
- Session persists across browser refreshes
- Password reset via email link

### 1.2 Session Management
- JWT token stored securely (Supabase handles this)
- Auto-logout after 24 hours of inactivity
- Single active session per user (no concurrent device management in MVP)

> **Scalability note:** Use Supabase Auth from day one. Row Level Security (RLS) policies reference `auth.uid()` on every table. Adding SSO, Google OAuth, or org-level auth in v2 requires zero schema changes — just enabling additional Supabase auth providers.

---

## 2. Catalog Management

### 2.1 Create a Catalog
- User can create a new catalog by providing:
  - Client name (free text, e.g. "Standard Chartered Bank")
  - Catalog name (free text, e.g. "SCB Capability Map v1")
  - Industry (select from fixed list: Banking, Healthcare, Retail, Airline, Insurance, Technology)
- Industry selection is stored in `capability_catalogs.industry` and passed to the RAG filter on every AI call
- One user can own multiple catalogs

### 2.2 List Catalogs
- Dashboard shows all catalogs owned by the logged-in user
- Each card shows: client name, catalog name, industry tag, node count, last updated timestamp
- Catalogs are isolated per user — no user can see another user's catalogs

### 2.3 Archive a Catalog
- User can archive a catalog (sets `status = 'archived'`)
- Archived catalogs are hidden from the dashboard by default
- No hard delete in MVP — archived catalogs can be restored

> **Scalability note:** The `user_id` FK on `capability_catalogs` and RLS policies mean adding team workspaces, org-level ownership, and `catalog_shares` in v2 requires only additive changes. The ownership model is already correct.

---

## 3. Spreadsheet Upload and Parsing

### 3.1 File Upload
- User uploads an `.xlsx` or `.csv` file via drag-drop or file picker in the Sidebar
- File is parsed entirely in the browser — no file is sent to the server
- Accepted format: columns A = L0, B = L1, C = L2, D = L3
- Maximum file size: 5 MB

### 3.2 Parsing
- Parser reads each row left to right — the first filled column determines the level
- Every node receives a UUID generated client-side
- Every node receives a `parentId` linking it to the nearest ancestor at the level above
- `sort_order` is assigned from the original row sequence
- Parser output is a flat JSON array of node objects written to the Zustand state store
- On parse error (malformed file, wrong columns): show a clear inline error message with guidance

### 3.3 Validation on Upload
- At least one L0 node must be present
- No node can skip a level (an L2 cannot appear without a parent L1)
- Maximum 500 nodes per upload in MVP (canvas performance limit)

> **Scalability note:** The parser output format (flat array with `id`, `parent_id`, `level`, `name`, `sort_order`) maps directly to the `capabilities` table schema. The same parser is used in v2 for bulk re-import, template loading, and CSV export round-trips.

---

## 4. Canvas — Visual Map

### 4.1 Render
- Canvas renders the full L0–L3 hierarchy as an interactive node graph
- Each level has a distinct visual style (colour, weight, size)
- Edges are drawn from each node to its parent using smooth curved lines
- Canvas uses React Flow as the rendering engine

### 4.2 Layout
- Dagre auto-layout calculates x,y positions for every node on initial load
- Layout recalculates automatically after every applied diff
- Incremental positioning for ghost preview: existing node coordinates are locked, only new nodes get positions calculated — prevents visual jumpiness

### 4.3 Interaction
- Pan: drag the canvas background
- Zoom: mouse wheel or trackpad pinch
- Node click: shows node label and level in a tooltip
- Canvas background click: deselects any selected node

### 4.4 Ghost Preview Overlay
- When an AI diff is pending (not yet approved), new nodes appear dashed and faded on the canvas
- Removed nodes appear with reduced opacity and a strikethrough label
- Existing nodes do not move during the ghost preview — only new nodes are positioned
- Ghost overlay disappears on Cancel; nodes animate to solid on Apply

> **Scalability note:** React Flow's custom node component API means adding drag-to-reposition, multi-select, node detail panels, and zoom-to-fit are all React Flow configuration additions in v2 — no architectural changes.

---

## 5. AI Prompt and Diff Pipeline

### 5.1 Prompt Input
- Prompt Box accepts free text natural language instructions
- Send via Enter key or Send button
- Loading state shown on canvas during AI processing
- Canvas is locked (non-interactive) during processing

### 5.2 Backend Pipeline (per prompt)
1. HTTP POST to `/api/prompt` carrying: prompt text + full nodes array + industry context
2. Embed prompt via `text-embedding-3-small` (OpenAI)
3. pgvector similarity search against `capability_chunks` filtered by industry (top 5 results)
4. Context Builder assembles: prompt + nodes + RAG chunks + system prompt rules
5. Claude Sonnet 4 call — returns JSON diff array only
6. Diff Normalizer: strip markdown fences, coerce synonyms, resolve placeholder IDs to real UUIDs
7. Return clean diff array to frontend

### 5.3 Validation (client-side)
- Zod schema check: correct types, valid enum values
- Parent level rule: L1 parent must be L0, L2 parent must be L1, L3 parent must be L2
- Orphan check: every parentId must resolve to an existing node
- Cycle check: DFS traversal — no circular references
- On failure: re-prompt Claude with the specific error (max 2 retries)
- On total failure: show user-readable error message, map unchanged

### 5.4 Retry Loop
- Max 2 automatic retries if validation fails
- Each retry sends the original prompt + the specific validation error to Claude
- If both retries fail: display error toast, clear loading state, map unchanged

> **Scalability note:** The pipeline is modular — each stage (embed, search, build, call, normalise, validate) is a separate function. Swapping Claude for GPT-4, adding the SLM classifier, or adding the Graph DB query in v2 means inserting a new function into the chain, not rewriting existing ones. The JSON diff format is the universal contract — never changes.

---

## 6. Preview Panel and Human Approval

### 6.1 Diff Summary
- Preview Panel shows a colour-coded list of proposed changes:
  - Green row with `+` for additions
  - Red row with `−` for removals
  - Amber row with `~` for renames
- Each row shows: node label, level badge, parent name

### 6.2 Apply Changes
- Apply Changes button commits the diff to the Zustand state
- Before any mutation: a full snapshot of the current nodes array is saved to the undo history stack
- All diff operations applied atomically (all-or-nothing)
- On success: Dagre recalculates layout, React Flow re-renders, ghost overlay becomes solid nodes
- New nodes from the diff are stored to `capabilities` table with `source = 'ai_generated'`
- A new row is inserted into `diff_history` with status `applied`
- A new row is inserted into `visual_maps` with `version_number` incremented and `is_active = true`; previous active row set to `is_active = false`

### 6.3 Cancel
- Cancel discards the diff and all ghost nodes
- Canvas returns to its previous state
- A row is inserted into `diff_history` with status `cancelled`
- No changes to `capabilities` or `visual_maps`

> **Scalability note:** The preview-before-apply pattern and `diff_history` table form the foundation for the full version history, diff replay, and undo-across-sessions features in v2. The data is already being collected correctly in MVP.

---

## 7. Undo / Redo

### 7.1 In-Session Undo / Redo
- Undo: restores the previous Zustand snapshot from the history stack
- Redo: re-applies a previously undone snapshot
- Both operations re-render the canvas immediately
- Keyboard shortcut: Ctrl+Z / Cmd+Z for undo, Ctrl+Y / Cmd+Y for redo

### 7.2 Session Boundary
- Undo history lives in Zustand — cleared when the browser tab is closed
- Cross-session undo (after page reload) is a v2 feature using `diff_history` replay

> **Scalability note:** The Zustand snapshot format is identical to what would be stored as a version snapshot in v2. No format migration needed when cross-session undo is added.

---

## 8. Version History (lightweight MVP)

### 8.1 Version List
- Sidebar shows the last 10 visual map versions for the current catalog
- Each version shows: version number, the prompt that created it, timestamp
- Active version is highlighted

### 8.2 Restore a Version
- Clicking a prior version loads its `layout_data` from `visual_maps` and its capability state from re-querying `capabilities` at that point
- MVP implementation: restore re-reads the full `capabilities` table (no diff replay)
- Toast confirmation on restore

> **Scalability note:** `diff_history` is already being populated correctly in MVP. Full diff replay to restore any arbitrary historical state is a v2 implementation on top of existing data.

---

## 9. Export

### 9.1 PNG Export
- Exports the current React Flow canvas as a PNG image
- Uses `html-to-image` library
- Download triggered immediately, no server call

### 9.2 JSON Save / Load
- Export: serialises the full Zustand nodes array to a `.json` file download
- Import: user uploads a previously exported JSON file to restore the exact map state
- Useful for sharing maps between consultants without catalog access

### 9.3 PPTX Export
- Generates a PowerPoint deck using `pptxgenjs`
- One slide per L0 capability group
- Each slide shows the L1–L3 children of that L0 in a structured layout
- Download triggered in browser, no server call

### 9.4 Miro Export (stretch MVP)
- Pushes the current map to a Miro board via REST API
- Creates one frame per L0 group, sticky notes for L1–L3 nodes
- Requires user to provide their Miro API token in Settings
- Included in MVP if time allows, otherwise first v2 feature

---

## 10. Infrastructure and Deployment

| Component | MVP choice | Reason |
|-----------|-----------|--------|
| Frontend | React + Vite on Vercel | Auto-deploy, CDN edge, free tier |
| Backend | Node.js + Express on Railway | Stateless, auto-restart, env var management |
| Database | Supabase (PostgreSQL + pgvector) | Managed, RLS built-in, vector search included |
| Cache | Redis on Railway | Sessions and prompt response cache |
| AI | Claude Sonnet 4 via Anthropic API | Best structured JSON output |
| Embeddings | text-embedding-3-small via OpenAI | Fast, cheap, 1536 dims, pgvector compatible |

---

## MVP Database Tables

| Table | Purpose |
|-------|---------|
| `capability_catalogs` | One row per client engagement |
| `capabilities` | All L0–L3 nodes for all catalogs |
| `visual_maps` | Layout snapshots, one per version |
| `diff_history` | Lightweight audit log of every prompt |
| `capability_chunks` | RAG knowledge base (embeddings + text) |

---

## What MVP Deliberately Excludes

| Feature | Reason excluded | When added |
|---------|----------------|-----------|
| Multi-user collaboration on same catalog | Adds complexity, not needed for solo consultant | v2 |
| SLM routing (Phi-3 / Llama) | Single LLM is simpler to debug | v2 |
| Graph DB (Neo4j) | pgvector alone is sufficient for early knowledge base | v2 |
| Cross-session undo via diff replay | In-session undo via Zustand is sufficient | v2 |
| Admin dashboard | No admin needed until multi-tenant | v2 |
| Notification system | No real-time events in MVP | v2 |
| Mobile / tablet layout | Desktop-first for consultants | v3 |
| Custom domain / white-labelling | Not needed for internal tool | v3 |

---

## Definition of Done — MVP

- [ ] A consultant can sign up, sign in, and sign out
- [ ] A consultant can create a catalog with client name, catalog name, and industry
- [ ] A consultant can upload an `.xlsx` file and see the L0–L3 map rendered on the canvas
- [ ] A consultant can type a plain English prompt and receive AI-generated changes in the Preview Panel
- [ ] A consultant can Apply or Cancel the proposed changes
- [ ] Undo and Redo work within the same session
- [ ] The version history sidebar shows the last 10 versions
- [ ] A consultant can export the map as PNG and PPTX
- [ ] All data is isolated per user — no user can access another user's catalogs
- [ ] The application is deployed and accessible via a public URL

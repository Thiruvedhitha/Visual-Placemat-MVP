# Visual Placemat MVP — Flow Architecture

## Design Principle: Local-First, Save on Apply

All editing happens in-memory (Zustand). The database is only touched when the user explicitly clicks **"Apply"**. This eliminates unnecessary DB writes during drag/drop, AI prompts, and undo/redo.

---

## High-Level Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Excel File │ ──► │  Parser      │ ──► │  Zustand Store  │
│  (.xlsx)    │     │  (client)    │     │  (in-memory)    │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                              Layout Engine   Drag & Drop    AI Prompts
                              (positions)     (local edit)   (diff → local)
                                    │              │              │
                                    └──────────────┼──────────────┘
                                                   ▼
                                          ┌─────────────────┐
                                          │  React Flow     │
                                          │  Canvas         │
                                          └────────┬────────┘
                                                   │
                                          User clicks "Apply"
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │  Supabase       │
                                          │  (bulk save)    │
                                          └─────────────────┘
```

---

## Phase 1: Parse & Hold in Zustand (No DB)

**Trigger:** User uploads `.xlsx` on `/documents` page.

**Flow:**
```
Excel file (.xlsx)
  → excelParser.ts (SheetJS, client-side)
  → ParsedCapabilityRow[] (flat array with l0, l1, l2, l3, description)
  → Zustand store: setCatalog({ name, industry, capabilities })
```

**What Zustand holds after upload:**
```typescript
interface CatalogStore {
  // Catalog metadata
  catalogId: string | null;        // null until first Apply (unsaved)
  catalogName: string;
  industry: string | null;

  // Capabilities (source of truth during editing)
  capabilities: Capability[];      // with temp client-side UUIDs
  tree: TreeNode[];                // parent-child hierarchy (derived)

  // Layout positions
  nodePositions: Map<string, {x: number, y: number}>;

  // Edit history (undo/redo)
  undoStack: CatalogSnapshot[];
  redoStack: CatalogSnapshot[];

  // Dirty flag
  isDirty: boolean;                // true if unsaved changes exist

  // Actions
  addCapability(cap): void;
  removeCapability(id): void;
  moveCapability(id, newParentId): void;
  updatePositions(positions): void;
  applyAIDiff(diff): void;
  undo(): void;
  redo(): void;
  markSaved(): void;
}
```

**Key:** `catalogId = null` means never saved to DB. The entire state lives in Zustand until Apply.

---

## Phase 2: Render & Edit Locally (Zero DB Calls)

**Layout Engine:**
```
Zustand capabilities[]
  → buildCanvasNodes(capabilities, visibleLevels)
  → React Flow Node[] with x, y positions
  → React Flow renders CapabilityNode components
```

**Editing operations — all modify Zustand only:**

| Operation | What happens | DB call? |
|-----------|-------------|----------|
| Drag node | Update `nodePositions` in Zustand | No |
| Toggle layer (L0-L3) | Re-run layout engine with updated `visibleLevels` | No |
| AI prompt → diff | Apply diff to `capabilities[]` in Zustand, push to undoStack | No |
| Undo | Pop undoStack → restore previous state | No |
| Redo | Pop redoStack → restore next state | No |
| Add/remove/rename node | Mutate `capabilities[]` in Zustand | No |
| Change node color/note | Update node data in Zustand | No |

**Undo/Redo architecture:**
```
Before any edit:
  1. Snapshot current state → push to undoStack
  2. Apply the edit
  3. Clear redoStack

Undo:
  1. Push current state → redoStack
  2. Pop undoStack → restore

Redo:
  1. Push current state → undoStack
  2. Pop redoStack → restore
```

---

## Phase 3: Apply → Bulk Save to Supabase

**Trigger:** User clicks **"Apply"** button.

**Flow:**
```
Zustand state
  → POST /api/catalogs/save
  → Single transaction:
      1. UPSERT capability_catalogs (create or update)
      2. DELETE existing capabilities for this catalog (if updating)
      3. Bulk INSERT all capabilities (level-by-level for parent_id resolution)
      4. INSERT visual_maps row (layout_data = React Flow positions as JSON)
      5. INSERT diff_history row (if AI prompt was involved)
  → Return { catalogId }
  → Zustand: set catalogId, isDirty = false
```

**First Apply (new catalog):**
```sql
-- 1. Create catalog
INSERT INTO capability_catalogs (name, industry) VALUES ($name, $industry) RETURNING id;

-- 2. Insert capabilities level-by-level (L0 → L1 → L2 → L3)
-- Uses full ancestor-path keys for parent_id resolution
INSERT INTO capabilities (catalog_id, parent_id, level, name, ...) VALUES (...);

-- 3. Save layout
INSERT INTO visual_maps (catalog_id, name, version_number, is_active, layout_data)
VALUES ($catalogId, 'v1', 1, true, $layoutJSON);
```

**Subsequent Apply (update existing):**
```sql
-- 1. Delete old capabilities
DELETE FROM capabilities WHERE catalog_id = $catalogId;

-- 2. Re-insert all capabilities (clean slate)
INSERT INTO capabilities (...) VALUES (...);

-- 3. Deactivate old layout, insert new version
UPDATE visual_maps SET is_active = false WHERE catalog_id = $catalogId;
INSERT INTO visual_maps (catalog_id, name, version_number, is_active, layout_data)
VALUES ($catalogId, 'v' || $nextVersion, $nextVersion, true, $layoutJSON);

-- 4. Log diff (if AI was used)
INSERT INTO diff_history (catalog_id, prompt_text, diff_payload, status, visual_map_id)
VALUES ($catalogId, $prompt, $diffJSON, 'applied', $newMapId);
```

---

## Phase 4: Re-open → Load from DB → Resume Editing

**Trigger:** User navigates to `/dashboard?catalogId=xxx`

**Flow:**
```
GET /api/capabilities?catalogId=xxx
  → capabilities[] from Supabase
GET /api/visual-maps?catalogId=xxx&active=true
  → layout_data (JSON with positions)
  → Zustand: setCatalog({ catalogId, capabilities, positions })
  → Layout engine renders canvas
  → User can resume editing locally
  → Next "Apply" = update cycle
```

---

## Auto-Draft: Prevent Data Loss

Unsaved work is preserved in `localStorage` (no DB needed):

```
Zustand state change
  → debounce 30 seconds
  → serialize to localStorage key: `draft:${catalogName}`

On page load:
  → check localStorage for draft
  → if found: show "Resume unsaved work?" prompt
  → if accepted: restore Zustand state from draft
  → if declined: clear draft
```

**Draft is cleared when:**
- User clicks "Apply" (saved to DB)
- User explicitly discards
- User starts a new upload (replaces draft)

---

## File Responsibilities

| File | Role | Phase |
|------|------|-------|
| `src/lib/parser/excelParser.ts` | Parse Excel → flat rows | Phase 1 |
| `src/stores/catalogStore.ts` | Zustand store (capabilities, positions, undo) | Phase 1–3 |
| `src/lib/canvas/layoutEngine.ts` | Flat rows → React Flow Node[] with x,y | Phase 2 |
| `src/components/canvas/CapabilityNode.tsx` | Custom React Flow node (colors, sizing) | Phase 2 |
| `src/app/(routes)/dashboard/page.tsx` | Canvas page (React Flow + sidebars) | Phase 2 |
| `src/app/api/catalogs/save/route.ts` | Bulk save endpoint (Apply button) | Phase 3 |
| `src/app/api/capabilities/route.ts` | GET: fetch capabilities for re-open | Phase 4 |
| `src/lib/db/postgres/capabilities.ts` | DB helpers (insert, fetch, dedup) | Phase 3–4 |

---

## What Changes vs Current Implementation

| Area | Current (DB-first) | New (Local-first) |
|------|-------------------|-------------------|
| Upload | Parse → DB insert → fetch → render | Parse → Zustand → render |
| Editing | Not supported (static canvas) | All edits in Zustand |
| Undo/Redo | Not implemented | Zustand snapshot stack |
| Save | Automatic on upload | Explicit "Apply" button |
| AI prompt | Future (would hit DB each time) | Applies diff to Zustand locally |
| Drag & drop | Disabled | Updates Zustand positions |
| Page reload | Data safe (in DB) | Draft in localStorage |
| Speed | Slow (DB roundtrip per action) | Instant (all in memory) |

---

## Data Flow Summary — One Row End to End

```
Excel cell "Budget Definition" (L3 column, row 2)
  │
  ▼ [Parser]
  { l0:"Strategy Mgmt", l1:"Portfolio Mgmt", l2:"Budget Mgmt", l3:"Budget Definition" }
  │
  ▼ [Zustand]
  { id:"temp-uuid-D", level:3, name:"Budget Definition", parentId:"temp-uuid-C" }
  │
  ▼ [Layout Engine]
  TreeNode: number="1.1.1.1", position={ x:6, y:153 }
  │
  ▼ [React Flow]
  42px pale blue node, text="1.1.1.1 Budget Definition"
  │
  ▼ [User clicks Apply]
  │
  ▼ [DB Insert]
  { id:"real-uuid-D", catalog_id:"cat-xxx", parent_id:"real-uuid-C",
    level:3, name:"Budget Definition", sort_order:3 }
  │
  ▼ [visual_maps]
  layout_data: { "real-uuid-D": { x:6, y:153 } }
```

---

## API Endpoints (Updated)

| Method | Endpoint | Purpose | When called |
|--------|----------|---------|-------------|
| `POST` | `/api/catalogs/save` | Bulk save: catalog + capabilities + layout | Apply button |
| `GET` | `/api/capabilities?catalogId=xxx` | Fetch capabilities for re-open | Dashboard load |
| `GET` | `/api/visual-maps?catalogId=xxx` | Fetch active layout positions | Dashboard load |
| `GET` | `/api/catalogs` | List all saved catalogs | Catalog list page |
| `POST` | `/api/prompt` | AI prompt → diff (future) | AI prompt submit |

---

## Key Design Decisions

1. **Temp UUIDs on client:** Use `crypto.randomUUID()` for client-side IDs during editing. On Apply, the DB generates real UUIDs. The ID mapping (temp → real) is handled during the save transaction.

2. **Delete + re-insert on Apply:** Simpler than diffing. On each Apply, delete all capabilities for the catalog and re-insert from Zustand state. This avoids complex merge logic.

3. **Layout positions in visual_maps:** Stored as JSONB in `layout_data`. Each Apply creates a new version row with `is_active = true` and deactivates previous versions.

4. **Undo stack size:** Cap at 50 snapshots to prevent memory bloat. Oldest entries are dropped.

5. **Draft expiry:** localStorage drafts expire after 7 days. On load, check timestamp and discard if stale.

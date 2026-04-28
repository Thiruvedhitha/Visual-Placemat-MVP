# Visual Placemat MVP — Database Schema

**Database:** Supabase (PostgreSQL)  
**Schema Version:** MVP (4 tables)  
**Total MVP Tables:** 4  
**Scale-up Tables (v2):** 3 additional

---

## MVP Scope

### What MVP needs end-to-end
- Upload xlsx → parse into L0–L3 capability tree → render on canvas
- Type a prompt → AI generates diff → Preview Panel → Apply or Cancel
- In-session undo/redo (Zustand handles this — no DB needed)
- Export PNG, JSON, PPTX
- Basic diff log — which prompt changed what (lightweight audit)

### What MVP deliberately skips (added in v2)
- Multi-user auth and ownership (`user_id`) — single consultant per instance is fine
- RAG knowledge base / `capability_chunks` / pgvector — AI calls Claude without RAG first
- Collaboration / `catalog_shares` — single consultant per map
- Prompt quality monitoring / `prompt_sessions` — not needed until AI is live with real users
- Soft delete / `is_deleted` — hard delete is fine at MVP scale
- `thumbnail_url` on visual_maps — just show version number + timestamp

---

## MVP Tables (4)

---

### Table 1: `capability_catalogs`

**Purpose:** One row per uploaded Excel file. Stores the catalog name, industry context for AI, and archive status.

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `id` | uuid | `gen_random_uuid()` | PK | Unique catalog identifier |
| `name` | text | — | NOT NULL | Catalog name, e.g., "SPM Capability Model" |
| `description` | text | — | — | Optional description |
| `industry` | text | — | — | "Banking" · "Healthcare" · "Retail" — passed to AI pipeline as context |
| `status` | text | `'active'` | — | `"active"` or `"archived"` — soft archive without deleting |
| `created_at` | timestamptz | `now()` | — | Upload timestamp |
| `updated_at` | timestamptz | `now()` | — | Last modified timestamp |

> **v2 addition:** `user_id` (FK → auth.users) and `client_name` — added when multi-user auth is introduced.

---

### Table 2: `capabilities`

**Purpose:** Stores every capability (L0–L3) from the Excel hierarchy. Self-referencing tree via `parent_id`.

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `id` | uuid | `gen_random_uuid()` | PK | Unique capability identifier |
| `catalog_id` | uuid | — | NOT NULL, FK → `capability_catalogs(id)` ON DELETE CASCADE | Which catalog this belongs to |
| `parent_id` | uuid | — | FK → `capabilities(id)` ON DELETE CASCADE | Parent capability (null = L0 root) |
| `level` | smallint | — | NOT NULL, CHECK (0–3) | 0=domain, 1=area, 2=capability, 3=sub-capability |
| `name` | text | — | NOT NULL | Capability name |
| `description` | text | — | — | Optional description from Excel |
| `sort_order` | integer | `0` | — | Preserves original Excel row order |
| `source` | text | `'xlsx_import'` | — | `"xlsx_import"` · `"ai_generated"` · `"manual"` — tracks origin of each node |
| `created_at` | timestamptz | `now()` | — | Insert timestamp |
| `updated_at` | timestamptz | `now()` | — | Auto-updated via trigger on every row change |

**Indexes:**
- `idx_capabilities_catalog` — on `catalog_id`
- `idx_capabilities_parent` — on `parent_id`
- `idx_capabilities_level` — on `(catalog_id, level)`
- `idx_capabilities_catalog_sort` — on `(catalog_id, sort_order)`

**Trigger:** `capabilities_updated_at` — auto-sets `updated_at = now()` on every UPDATE.

**Parent-child chain:**
```
L0 (parent_id = null)
 └─ L1 (parent_id → L0's id)
     └─ L2 (parent_id → L1's id)
         └─ L3 (parent_id → L2's id)
```

> **v2 addition:** `is_deleted` (boolean) — soft delete for cross-session undo. At MVP, hard delete is fine and in-session undo is handled by Zustand.

---

### Table 3: `visual_maps`

**Purpose:** Stores React Flow canvas layout snapshots. Each "Apply Changes" inserts a **new version row**; old rows get `is_active = false`. Free version history without extra infrastructure.

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `id` | uuid | `gen_random_uuid()` | PK | Unique map identifier |
| `catalog_id` | uuid | — | NOT NULL, FK → `capability_catalogs(id)` ON DELETE CASCADE | Which catalog this layout belongs to |
| `name` | text | — | NOT NULL | Layout name, e.g., "SPM Capability Map v1" |
| `version_number` | integer | `1` | — | Increments per catalog on each Apply |
| `is_active` | boolean | `true` | — | Only one row per catalog is `true` — the current version |
| `layout_data` | jsonb | — | — | Full React Flow node/edge positions as JSON |
| `created_at` | timestamptz | `now()` | — | Creation timestamp |
| `updated_at` | timestamptz | `now()` | — | Last modified timestamp |

**Index:** `idx_visual_maps_active` — on `(catalog_id, is_active)`

**Design rule — versioning on Apply:**
```sql
-- Step 1: deactivate current layout
UPDATE visual_maps SET is_active = false WHERE catalog_id = $catalog_id;

-- Step 2: insert new version
INSERT INTO visual_maps (catalog_id, name, version_number, is_active, layout_data)
VALUES ($catalog_id, 'Map v' || $next_version, $next_version, true, $new_layout_data);
```

> **v2 addition:** `thumbnail_url` — preview image for version history sidebar.

---

### Table 4: `diff_history`

**Purpose:** Lightweight audit log. Tracks which prompt caused which changes. Powers the version history sidebar — shows "what changed" and "which prompt caused it". Slim MVP version with 7 fields only.

| Column | Type | Default | Constraints | Description |
|--------|------|---------|-------------|-------------|
| `id` | uuid | `gen_random_uuid()` | PK | Unique diff identifier |
| `catalog_id` | uuid | — | FK → `capability_catalogs(id)` ON DELETE CASCADE | Which catalog was modified |
| `prompt_text` | text | — | NOT NULL | The exact user prompt, e.g., "Add risk management capabilities" |
| `diff_payload` | jsonb | — | NOT NULL | The full diff array from Claude: `[{action, level, name, parent_id}...]` |
| `status` | text | `'applied'` | — | `"applied"` or `"cancelled"` |
| `visual_map_id` | uuid | — | FK → `visual_maps(id)` ON DELETE SET NULL | Links to the layout snapshot this diff produced (null if cancelled) |
| `created_at` | timestamptz | `now()` | — | When the diff was generated |

**Indexes:**
- `idx_diff_history_catalog` — on `catalog_id`
- `idx_diff_history_created` — on `created_at DESC`

> **v2 additions:** `applied_by` (FK → auth.users), `model_used` (text), `applied_at` (timestamptz), status gains `"rolled_back"` option.

---

## Relationships (MVP)

```
capability_catalogs
 ├── 1:N → capabilities (catalog_id)
 ├── 1:N → visual_maps (catalog_id)
 └── 1:N → diff_history (catalog_id)

capabilities
 └── self-ref → capabilities (parent_id)

visual_maps
 └── 1:N ← diff_history (visual_map_id)
```

---

## v2 Scale-up Tables (added when needed)

These tables are **not created at MVP**. They are added when the application scales to multi-user, RAG, and prompt monitoring.

---

### Table 5: `capability_chunks` (RAG Knowledge Base)

**When to add:** When AI prompt editing moves from direct Claude calls to RAG-augmented calls with industry-specific context.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Unique chunk identifier |
| `label` | text NOT NULL | Capability label |
| `level` | text NOT NULL | Capability level |
| `industry` | text NOT NULL | Industry tag — the isolation filter for RAG queries |
| `content` | text NOT NULL | Readable text sent to Claude |
| `embedding` | vector(1536) | pgvector column for similarity search |
| `source` | text NOT NULL | `"template"` or `"client_map"` |
| `source_catalog_id` | uuid FK | Traceability link to source catalog |
| `created_at` | timestamptz | Ingestion timestamp |

**Key design:** No RLS — shared across all users. Filtered by `industry` at query time. Client names are anonymised at ingestion so RAG never exposes client identity.

**RAG query pattern:**
```sql
SELECT content FROM capability_chunks
WHERE industry = 'Banking'
ORDER BY embedding <=> $prompt_vector
LIMIT 5;
```

---

### Table 6: `prompt_sessions` (Observability)

**When to add:** When AI is live with real users and you need to monitor prompt quality, latency, and errors.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Unique session identifier |
| `catalog_id` | uuid FK | Which catalog the prompt targeted |
| `user_id` | uuid FK | Who submitted the prompt |
| `prompt` | text NOT NULL | The prompt text |
| `model_used` | text | AI model used (e.g., "claude-sonnet-4") |
| `retry_count` | smallint | Number of retries before success |
| `validation_error` | text | Error message if diff validation failed |
| `latency_ms` | integer | Round-trip time in milliseconds |
| `created_at` | timestamptz | Submission timestamp |

**RLS:** User sees only their own sessions.

---

### Table 7: `catalog_shares` (Collaboration)

**When to add:** When multiple consultants need to view or edit the same catalog.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Unique share identifier |
| `catalog_id` | uuid FK | Which catalog is being shared |
| `user_id` | uuid FK | Who it's shared with |
| `role` | text | `"viewer"` · `"editor"` · `"owner"` |
| `created_at` | timestamptz | When the share was created |

**Constraint:** `UNIQUE(catalog_id, user_id)` — one share per user per catalog.

---

## RLS Summary

| Table | MVP | v2 |
|-------|-----|-----|
| `capability_catalogs` | RLS disabled (single user) | Owner or shared via `catalog_shares` |
| `capabilities` | RLS disabled | Scoped via catalog ownership |
| `visual_maps` | RLS disabled | Scoped via catalog ownership |
| `diff_history` | RLS disabled | Owner only |
| `capability_chunks` | — | No RLS (shared, filtered by industry) |
| `prompt_sessions` | — | User sees only their own |
| `catalog_shares` | — | Helper table for other RLS policies |

---

## Migration Path: MVP → v2

| Step | SQL |
|------|-----|
| 1. Add auth columns | `ALTER TABLE capability_catalogs ADD COLUMN user_id uuid REFERENCES auth.users(id), ADD COLUMN client_name text` |
| 2. Add soft delete | `ALTER TABLE capabilities ADD COLUMN is_deleted boolean DEFAULT false` |
| 3. Add thumbnail | `ALTER TABLE visual_maps ADD COLUMN thumbnail_url text` |
| 4. Expand diff_history | `ALTER TABLE diff_history ADD COLUMN applied_by uuid, ADD COLUMN model_used text, ADD COLUMN applied_at timestamptz` |
| 5. Create v2 tables | Run CREATE TABLE for `capability_chunks`, `prompt_sessions`, `catalog_shares` |
| 6. Enable RLS | Enable RLS + create ownership policies on all tables |
| 7. Enable pgvector | `CREATE EXTENSION IF NOT EXISTS vector` (required for capability_chunks) |

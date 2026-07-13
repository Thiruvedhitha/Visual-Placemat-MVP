# Visual Placemat — Database Schema

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AUTH (Supabase Built-in)                            │
│                                                                                 │
│   auth.users                                                                    │
│   ├── id (uuid) ← referenced by all user_id FKs                                │
│   ├── email                                                                     │
│   └── user_metadata (full_name, avatar_url, etc.)                               │
└─────────────────────────────────────────────────────────────────────────────────┘
          │
          │ user_id / created_by / applied_by / invited_by
          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT FOLDER MANAGEMENT                              │
│                                                                                 │
│  ┌──────────────────────┐         ┌───────────────────────────┐                │
│  │  clients              │◄────────│  client_members           │                │
│  │  ─────────────────── │         │  ───────────────────────  │                │
│  │  id          uuid PK │         │  id          uuid PK      │                │
│  │  name        text     │         │  client_id   uuid FK ─────┘                │
│  │  industry    text     │         │  user_id     uuid FK → auth.users          │
│  │  description text     │         │  role        "admin"|"editor"|"viewer"      │
│  │  logo_url    text     │         │  invited_by  uuid FK → auth.users          │
│  │  created_by  uuid FK  │         │  created_at  timestamptz                   │
│  │  created_at  ts       │         │  UNIQUE(client_id, user_id)                │
│  │  updated_at  ts       │         └───────────────────────────┘                │
│  └──────────┬───────────┘                                                       │
│             │ client_id                                                          │
│             ▼                                                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CAPABILITY MAP CORE                                    │
│                                                                                 │
│  ┌──────────────────────────────────┐                                          │
│  │  capability_catalogs              │ ← One per uploaded Excel / template      │
│  │  ──────────────────────────────  │                                          │
│  │  id           uuid PK            │                                          │
│  │  user_id      uuid FK → users    │  (owner/creator)                         │
│  │  client_id    uuid FK → clients  │  (which client folder it belongs to)     │
│  │  name         text               │  "AMEX SPM Capability"                   │
│  │  description  text               │                                          │
│  │  client_name  text               │  (legacy display label)                  │
│  │  industry     text               │  "Banking" (used for RAG filtering)      │
│  │  status       "active"|"archived"│                                          │
│  │  node_styles  jsonb              │  (visual overrides per node)             │
│  │  chat_history jsonb              │  (AI commit log)                         │
│  │  created_at   timestamptz        │                                          │
│  │  updated_at   timestamptz        │                                          │
│  └──────────┬───────────────────────┘                                          │
│             │ catalog_id                                                         │
│             ▼                                                                    │
│  ┌──────────────────────────────────┐     ┌─────────────────────────────┐      │
│  │  capabilities                     │     │  visual_maps                 │      │
│  │  ──────────────────────────────  │     │  ─────────────────────────  │      │
│  │  id           uuid PK            │     │  id              uuid PK    │      │
│  │  catalog_id   uuid FK            │     │  catalog_id      uuid FK    │      │
│  │  parent_id    uuid FK → self     │     │  name            text       │      │
│  │  level        0 | 1 | 2 | 3     │     │  version_number  integer    │      │
│  │  name         text               │     │  layout_data     jsonb      │      │
│  │  description  text               │     │  is_active       boolean    │      │
│  │  note         text               │     │  thumbnail_url   text       │      │
│  │  sort_order   integer            │     │  created_at      ts         │      │
│  │  source       text               │     │  updated_at      ts         │      │
│  │  is_deleted   boolean            │     └─────────────────────────────┘      │
│  │  created_at   timestamptz        │                                          │
│  │  updated_at   timestamptz        │                                          │
│  └──────────────────────────────────┘                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          AI & AUDIT                                             │
│                                                                                 │
│  ┌──────────────────────────────────┐     ┌─────────────────────────────┐      │
│  │  diff_history                     │     │  prompt_sessions             │      │
│  │  ──────────────────────────────  │     │  ─────────────────────────  │      │
│  │  id            uuid PK           │     │  id               uuid PK   │      │
│  │  catalog_id    uuid FK           │     │  catalog_id       uuid FK   │      │
│  │  applied_by    uuid FK → users   │     │  user_id          uuid FK   │      │
│  │  prompt_text   text              │     │  prompt           text      │      │
│  │  diff_payload  jsonb             │     │  model_used       text      │      │
│  │  status        text              │     │  retry_count      smallint  │      │
│  │  model_used    text              │     │  validation_error text      │      │
│  │  visual_map_id uuid FK           │     │  latency_ms       integer   │      │
│  │  created_at    timestamptz       │     │  created_at       ts        │      │
│  │  applied_at    timestamptz       │     └─────────────────────────────┘      │
│  └──────────────────────────────────┘                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SHARING & RAG                                          │
│                                                                                 │
│  ┌──────────────────────────────────┐     ┌─────────────────────────────┐      │
│  │  catalog_shares                   │     │  capability_chunks (RAG)     │      │
│  │  ──────────────────────────────  │     │  ─────────────────────────  │      │
│  │  id          uuid PK             │     │  id                uuid PK  │      │
│  │  catalog_id  uuid FK             │     │  label             text     │      │
│  │  user_id     uuid FK → users     │     │  level             text     │      │
│  │  role        "viewer"|"editor"   │     │  industry          text     │      │
│  │  created_at  timestamptz         │     │  content           text     │      │
│  │  UNIQUE(catalog_id, user_id)     │     │  embedding         vec(1536)│      │
│  └──────────────────────────────────┘     │  source            text     │      │
│                                            │  source_catalog_id uuid FK  │      │
│                                            │  created_at        ts       │      │
│                                            └─────────────────────────────┘      │
│                                            (NO RLS — shared knowledge base,     │
│                                             filtered by industry at query time)  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tables Summary

| # | Table | Purpose | Row Count Expectation |
|---|-------|---------|----------------------|
| 1 | `clients` | Client folder entity (e.g., "AMEX", "XYZ Corp") | 10–100 |
| 2 | `client_members` | ACL: who can access which client folder | 10–500 |
| 3 | `capability_catalogs` | One per uploaded Excel or instantiated template | 50–500 |
| 4 | `capabilities` | L0→L1→L2→L3 hierarchy per catalog | 5,000–50,000 |
| 5 | `visual_maps` | Versioned React Flow layouts per catalog | 100–2,000 |
| 6 | `diff_history` | Audit trail of every AI-driven change | 500–10,000 |
| 7 | `prompt_sessions` | AI prompt observability (latency, retries) | 500–10,000 |
| 8 | `catalog_shares` | Direct catalog sharing (legacy, pre-client folders) | 10–200 |
| 9 | `capability_chunks` | RAG vector embeddings for AI suggestions | 1,000–100,000 |

---

## Relationship Map

| From | → To | FK Column | Cardinality | Purpose |
|------|------|-----------|-------------|---------|
| `client_members` | `clients` | `client_id` | Many:1 | Who has access to a client folder |
| `client_members` | `auth.users` | `user_id` | Many:1 | Which user |
| `clients` | `auth.users` | `created_by` | Many:1 | Who created the folder |
| `capability_catalogs` | `clients` | `client_id` | Many:1 | Map belongs to client folder |
| `capability_catalogs` | `auth.users` | `user_id` | Many:1 | Map creator/owner |
| `capabilities` | `capability_catalogs` | `catalog_id` | Many:1 | Capabilities belong to a map |
| `capabilities` | `capabilities` | `parent_id` | Many:1 | Self-referencing hierarchy |
| `visual_maps` | `capability_catalogs` | `catalog_id` | Many:1 | Layout versions per map |
| `diff_history` | `capability_catalogs` | `catalog_id` | Many:1 | Change log per map |
| `diff_history` | `auth.users` | `applied_by` | Many:1 | Who made the change |
| `diff_history` | `visual_maps` | `visual_map_id` | Many:1 | Which version snapshot |
| `prompt_sessions` | `capability_catalogs` | `catalog_id` | Many:1 | AI prompts per map |
| `catalog_shares` | `capability_catalogs` | `catalog_id` | Many:1 | Sharing access |
| `catalog_shares` | `auth.users` | `user_id` | Many:1 | Shared with whom |
| `capability_chunks` | `capability_catalogs` | `source_catalog_id` | Many:1 | RAG chunk origin |

---

## Capability Hierarchy (capabilities table)

```
L0: Strategic Portfolio Management          ← Domain (colored band)
├── L1: Strategy & OKR                      ← Group (column)
│   ├── L2: Strategy Definition             ← Subgroup (section header)
│   │   ├── L3: Define Strategic Goals      ← Leaf (bullet item)
│   │   ├── L3: Prioritize Initiatives
│   │   └── L3: Align to OKRs
│   └── L2: Strategy Execution
│       ├── L3: Track Progress
│       └── L3: Report Outcomes
└── L1: Governance
    └── L2: Compliance
        ├── L3: Policy Management
        └── L3: Risk Assessment
```

**Linked by:** `parent_id → capabilities.id` (self-referencing FK)

---

## Access Control (Row Level Security)

```
User authenticates (Microsoft SSO via Supabase)
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  3 ways a user can access a capability_catalog:              │
│                                                              │
│  1. OWNER:  catalog.user_id = auth.uid()                     │
│  2. SHARED: catalog_shares.user_id = auth.uid()              │
│  3. CLIENT: client_members.user_id = auth.uid()              │
│             AND catalog.client_id = client_members.client_id │
└──────────────────────────────────────────────────────────────┘
       │
       ▼ Access cascades down:
┌──────────────────────────────────────────────────────────────┐
│  capability_catalogs → capabilities (via catalog_id)         │
│  capability_catalogs → visual_maps   (via catalog_id)        │
│  capability_catalogs → diff_history  (via catalog_id)        │
│  capability_catalogs → prompt_sessions (via catalog_id)      │
└──────────────────────────────────────────────────────────────┘
```

---

## Role Permissions (client_members.role)

| Action | Admin | Editor | Viewer |
|--------|:-----:|:------:|:------:|
| View client folder & maps | ✅ | ✅ | ✅ |
| Open capability canvas | ✅ | ✅ | ✅ |
| Create/upload new maps | ✅ | ✅ | ❌ |
| Edit capabilities (AI/manual) | ✅ | ✅ | ❌ |
| Instantiate templates | ✅ | ✅ | ❌ |
| Add/remove members | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ❌ | ❌ |
| Rename/delete client folder | ✅ | ❌ | ❌ |
| View diff/audit history | ✅ | ✅ | ❌ |

---

## SQL Files Location

| File | Purpose |
|------|---------|
| `src/lib/db/postgres/schema.sql` | Base schema (7 tables + RLS) |
| `src/lib/db/postgres/migration_clients.sql` | Client folders migration (2 new tables + updated RLS) |
| `src/lib/db/postgres/migration_mvp_v2.sql` | Earlier migration (if applicable) |

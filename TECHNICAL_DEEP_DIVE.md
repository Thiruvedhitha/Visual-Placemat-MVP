# Visual Placemat — Technical Deep Dive

> A single reference document that describes **what this application is, how every layer is built, which algorithms it runs, and how the pieces fit together end-to-end.** Read this to understand the engineering surface area behind the product.

---

## Table of Contents
1. [Product Summary](#1-product-summary)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack (with justification)](#3-technology-stack-with-justification)
4. [Repository & Package Layout](#4-repository--package-layout)
5. [Data Model & Database Design](#5-data-model--database-design)
6. [End-to-End Flows](#6-end-to-end-flows)
7. [Excel/CSV Ingestion Pipeline](#7-excelcsv-ingestion-pipeline)
8. [Canvas & Layout Engine (Algorithms)](#8-canvas--layout-engine-algorithms)
9. [Command System — AI-Driven Diagram Edits](#9-command-system--ai-driven-diagram-edits)
10. [Meeting Transcript Pipeline (3-Pass LLM)](#10-meeting-transcript-pipeline-3-pass-llm)
11. [Capability Style Categories (Legend System)](#11-capability-style-categories-legend-system)
12. [State Management (Zustand)](#12-state-management-zustand)
13. [Authentication, RBAC & Middleware](#13-authentication-rbac--middleware)
14. [Versioning & Save Semantics](#14-versioning--save-semantics)
15. [Export Subsystem](#15-export-subsystem)
16. [AI / LLM Layer](#16-ai--llm-layer)
17. [Security Model](#17-security-model)
18. [Performance Techniques](#18-performance-techniques)
19. [Skills Demonstrated](#19-skills-demonstrated)

---

## 1. Product Summary

**Visual Placemat** is a full-stack web application that turns raw enterprise **capability catalogs** (Excel/CSV hierarchies of business capabilities from L0 → L3) into interactive, LeanIX-style **visual capability maps** ("placemats"). Once rendered, users can:

- Drag/drop and reparent nodes on an infinite canvas
- Colour-code capabilities using a live legend
- Attach notes, descriptions, and per-node style overrides
- Edit the map through **natural-language AI prompts** (chat)
- Ingest **meeting transcripts** (.docx / .vtt) and let the AI extract new capabilities or edits automatically
- Version, tag, rename, archive, and share diagrams with role-based access
- Export the final artefact to PNG, SVG, PDF, PowerPoint, JSON, and CSV

It is delivered as a single Next.js 14 application (frontend + serverless API) backed by Supabase (Postgres + Auth) and OpenAI / Anthropic LLMs.

---

## 2. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React 18 + Tailwind)                   │
│                                                                           │
│   Landing • Documents • Dashboard (React Flow canvas) • Transcript UI     │
│   Export • Admin • Clients • Works • Login                                │
│                                                                           │
│   State: Zustand (persist middleware, undo/redo, dirty tracking)          │
│   Canvas: React Flow 11 + custom CapabilityNode / DropContainerNode      │
└─────────────┬─────────────────────────────────────────────────────────────┘
              │  fetch("/api/…")   ← same-origin, no CORS
              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                   NEXT.JS API ROUTES (serverless, Node 20)               │
│                                                                           │
│  /api/documents           /api/catalogs/*        /api/capabilities        │
│  /api/transform (LLM)     /api/transcripts/*     /api/chat                │
│  /api/export              /api/clients/*         /api/admin/*             │
│  /api/usage-stats         /api/auth              /api/profile             │
│                                                                           │
│  Middleware: /src/middleware.ts → refreshes Supabase session, guards      │
│              private routes, injects auth cookies.                       │
└─────────────┬─────────────────────────────────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      DOMAIN / BUSINESS LOGIC (src/lib)                   │
│                                                                           │
│  parser/       →  SheetJS-based Excel/CSV parser                         │
│  canvas/       →  Layout engine, drag-drop rules, numbering              │
│  commands/     →  DiagramCommand DSL, prompt builder, executor          │
│  transcript/   →  Clean → Pass1 → Pass2 → Pass3 pipeline                │
│  capabilityStyles.*  →  Legend / style category CRUD & migration       │
│  auth/         →  RBAC (admin/editor/viewer), audit                     │
│  db/postgres/  →  Supabase clients + typed queries                      │
└─────────────┬─────────────────────────────────────────────────────────────┘
              │  Supabase JS SDK (service role on server, anon on client)
              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│           SUPABASE (managed Postgres 15) + Supabase Auth                 │
│                                                                           │
│  capability_catalogs   capabilities             capability_style_cats    │
│  visual_maps           diff_history             meeting_transcripts      │
│  transcript_proposals  ai_usage_log             clients + memberships    │
│                                                                           │
│  Postgres features used: UUIDv4, self-referencing FK, JSONB, text[]     │
│                          CHECK constraints, composite FKs, RLS-ready.   │
└─────────────┬─────────────────────────────────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL AI PROVIDERS                           │
│                                                                           │
│  OpenAI  (gpt-4.1 / gpt-4.1-mini)   ← chat edits + transcript passes    │
│  Anthropic Claude (sonnet)           ← alt provider via @anthropic-ai   │
│  Gemini                              ← optional secondary provider      │
│                                                                           │
│  All calls: server-side only, API keys never reach the browser.         │
└───────────────────────────────────────────────────────────────────────────┘
```

**Deployment target:** Vercel (frontend + edge/serverless API) or Render (long-running Node). No URL rewrites needed — the app uses relative `/api/*` paths so the same build works locally, on Vercel, and on Render.

---

## 3. Technology Stack (with justification)

| Layer | Tech | Version | Why it was chosen |
|-------|------|---------|-------------------|
| Framework | **Next.js 14** (App Router) | 14.2 | Single project ships both React UI and Node API routes; server-side secret handling; file-based routing; RSC-ready. |
| UI | **React 18** + TypeScript | 18.3 / 5.4 | Component model + strict typing across the boundary. |
| Styling | **Tailwind CSS** | 3.4 | Utility classes keep JSX self-contained; no CSS-in-JS runtime cost. |
| Canvas | **React Flow 11** | 11.11 | Purpose-built node/edge canvas with pan/zoom, custom node types, virtualization. |
| Spreadsheet parsing | **SheetJS (xlsx)** | 0.18 | Battle-tested XLSX/CSV parser; runs both in browser (preview) and server (canonical). |
| DOCX parsing | **mammoth** | 1.12 | Extracts plain text from Word transcripts for the LLM pipeline. |
| Image capture | **html-to-image** | 1.11 | DOM → PNG/SVG at 2× DPR for export. |
| PDF | **jsPDF** | 4.2 | Client-side PDF generation for downloads. |
| PowerPoint | **pptxgenjs** | 4.0 | Emits real .pptx from the current diagram. |
| ZIP bundle | **archiver** | 8 | Streams multi-file exports. |
| Database | **Supabase (Postgres 15)** | — | Managed Postgres + Auth + Row-Level Security in one place. |
| Auth | **@supabase/ssr** | 0.12 | Cookie-based sessions that survive server round-trips. |
| State | **Zustand 5** | 5.0 | Tiny, unopinionated, works with `persist` middleware for undo/redo and dirty flag. |
| LLM SDKs | **openai**, **@anthropic-ai/sdk** | 6 / 0.93 | Official SDKs for the two production model families. |
| Language | **TypeScript** | 5.4 | End-to-end type safety, especially across the command/diff DSL. |
| Hosting | Vercel / Render + Supabase | — | Zero-config Next deploys; single set of env vars per environment. |

---

## 4. Repository & Package Layout

```
Visual-Placemat-MVP/
├── package.json               ← single package, no monorepo
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── scripts/
│   ├── migrations/            ← dated SQL migrations (2026-08-*, 2026-09-*)
│   ├── generate-*-excel.js    ← catalog scaffolding scripts
│   └── seed-builtin-template.js
├── public/
│   └── usage-dashboard.html   ← standalone usage viewer
└── src/
    ├── middleware.ts          ← Supabase session refresh + route guard
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx           ← landing
    │   ├── globals.css
    │   ├── (routes)/          ← route group (excluded from URL)
    │   │   ├── dashboard/     ← main canvas
    │   │   ├── documents/     ← upload
    │   │   ├── transform/     ← AI transform
    │   │   ├── view/          ← read-only diagram
    │   │   ├── export/        ← PNG/SVG/PDF/PPTX
    │   │   ├── clients/       ← folders / org spaces
    │   │   ├── works/         ← user's saved works
    │   │   ├── admin/         ← platform-admin console
    │   │   └── login/
    │   ├── api/               ← every backend endpoint
    │   │   ├── documents/     ├── catalogs/
    │   │   ├── capabilities/  ├── transcripts/
    │   │   ├── transform/     ├── chat/
    │   │   ├── export/        ├── clients/
    │   │   ├── admin/         ├── my-works/
    │   │   ├── profile/       ├── auth/
    │   │   ├── embeddings/    ├── graph/
    │   │   └── usage-stats/
    │   └── auth/              ← OAuth callback + signin pages
    ├── components/
    │   ├── canvas/            ← CapabilityNode, sidebars, toolbars, wizards
    │   ├── transcript/        ← Upload, ReviewModal, ProgressBar
    │   ├── preview/           ├── export/
    │   ├── layout/            └── ui/
    ├── lib/                   ← pure domain logic (no React)
    │   ├── parser/            ├── canvas/
    │   ├── commands/          ├── transcript/
    │   ├── capabilityStyles*  ├── ai/{llm,slm,embeddings,orchestrator}
    │   ├── auth/              └── db/{postgres,redis,neo4j,vector}
    ├── stores/                ← Zustand stores (catalogStore.ts)
    ├── config/                types/                utils/
    └── middleware/
```

The `(routes)` folder uses Next.js **route groups** so it disappears from URLs while still keeping the code physically organised.

---

## 5. Data Model & Database Design

Core Postgres schema (Supabase). Notable design choices are annotated.

### `capability_catalogs`
Top-level "diagram" record.

| Column | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → auth.users | Owner |
| `client_id` | uuid FK → clients | Folder/org space (nullable = personal) |
| `name`, `description`, `industry`, `client_name`, `notes` | text | |
| `tags` | `text[]` default `{}` | Diagram tags ("Capability", "Process"…) |
| `node_styles` | jsonb | Legacy per-node style overrides (dual-read) |
| `chat_history` | jsonb | Persisted AI chat log per diagram |
| `status` | text | `active` / `archived` |

### `capabilities`
The hierarchical L0–L3 tree.

| Column | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `catalog_id` | uuid FK | |
| `parent_id` | uuid FK → capabilities.id | **Self-referencing** for tree structure |
| `level` | smallint 0..3 | `CHECK (level BETWEEN 0 AND 3)` |
| `name`, `description`, `note` | text | |
| `sort_order` | integer | Drives numbering + sibling order |
| `source` | text | `xlsx_import` / `manual` / `ai` / `transcript` |
| `is_deleted` | boolean | Soft delete |
| `fill_category_id`, `border_category_id`, `text_category_id` | uuid FK | **Composite FK** into `capability_style_categories` (catalog-scoped) |

### `capability_style_categories`
Per-catalog legend entries (fill / border / textColor).

Uses `UNIQUE (catalog_id, slot, entry_key)` and a **composite unique** `(catalog_id, id)` so `capabilities` can enforce that a style category belongs to the same catalog as the capability referencing it. This prevents cross-catalog leakage at the DB level.

### `visual_maps`
Versioned React Flow layout snapshots — `layout_data` is jsonb, `is_active` flags the current version.

### `diff_history`
Audit log of every applied AI change (prompt text + diff payload + status).

### `meeting_transcripts` + `transcript_proposals`
Transcript ingestion state machine (see §10).

### `ai_usage_log`
Per-request tokens + USD cost logged to Supabase from every LLM call.

### `clients` + memberships
Multi-tenant "folders" with per-user roles (`admin` / `editor` / `viewer`) used by the RBAC helper (§13).

### Key modelling techniques
- **Adjacency-list tree** (`parent_id`) — chosen over nested sets for simplicity and cheap subtree writes.
- **Level column** kept alongside `parent_id` so range filters (`level ≤ 2`) don't require recursion.
- **Composite FKs** for style categories → strong catalog isolation.
- **Numbering (1, 1.1, 1.1.1) is NOT stored** — always computed on the fly from `parent_id` + `sort_order` in four independent locations kept in sync (`layoutEngine`, `promptBuilder`, `transform/route`, `dragDropHandler`).

---

## 6. End-to-End Flows

### 6.1 Excel upload → canvas
```
User drops .xlsx → /documents
  → SheetJS parses in browser for preview + validation
  → POST /api/documents (FormData)
       → parseCapabilityCatalog() canonicalises
       → findDuplicateCatalog() dedup check
       → createCatalog() returns catalogId immediately
       → insertCapabilitiesForCatalog() runs in background (L0→L3)
  → 302 to /dashboard?catalogId=<uuid>
  → GET /api/capabilities?catalogId=... fills Zustand
  → buildCanvasNodes() computes positions
  → React Flow renders
```

### 6.2 Local edit (drag / recolor / add) — zero DB writes
All mutations go through Zustand actions; `isDirty=true`. A single **Apply** click flushes.

### 6.3 AI edit via chat
```
User types prompt
  → POST /api/transform  { catalog, prompt, history }
       → buildCommandPrompt() renders system prompt + capability tree
       → openai.chat.completions.create({ response_format: json_object })
       → executeCommands() validates + applies DiagramCommand[]
       → appendUsageLog() writes token cost to ai_usage_log
  → returns { commands, patches, capabilities, summary }
  → dashboard merges patches into React Flow node.data
```

### 6.4 Transcript ingestion
`.docx` / `.vtt` upload → pipeline (§10) → proposals → user review modal → accepted proposals become live commands via the same `executeCommands` path.

### 6.5 Save (Apply)
`POST /api/catalogs/save` runs a versioned transaction: upsert catalog + wipe/reinsert capabilities + insert new `visual_maps` row with `is_active=true` (older versions kept for restore).

### 6.6 Export
Client renders the canvas, `html-to-image` captures at `pixelRatio: 2`, then jsPDF / pptxgenjs / SheetJS wrap the pixels or JSON as needed.

---

## 7. Excel/CSV Ingestion Pipeline

Implemented in [src/lib/parser/excelParser.ts](src/lib/parser/excelParser.ts).

### Algorithm
1. `XLSX.read(buffer, { type: "array" })` — SheetJS parses the workbook.
2. Prefer a sheet whose name contains "Capability Catalog", else first sheet.
3. Convert to 2-D array via `sheet_to_json(sheet, { header: 1 })`.
4. Header inference (two supported shapes):
   - **Wide**: `L0 Capability Name | L1 … | L2 … | L3 … | Description`
   - **Tall**: `Level | Capability Name | Description`
5. Regex-based column detection: `/l0/i`, `/l1/i`, `/l2/i`, `/l3/i`, `/^level$/i`, `/desc|definition/i`.
6. **Forward-fill** the current L0/L1/L2 names as you walk rows so a row with only an L3 value inherits its ancestors.
7. Every row emits a `ParsedCapabilityRow { l0, l1, l2, l3, description }`.
8. Duplicate detection: row count + set of L0 names hashed → matches existing catalogs.
9. Insertion is done **level by level** (L0 then L1 then L2 then L3) so that `parent_id` can be resolved via an in-memory `pathToId` map (`"L0>L1>L2"` → UUID) without extra round-trips.

### Why this design
- Supports messy real-world Excel exports (blank cells, merged names, missing columns).
- Level-by-level insert avoids ordering issues in a self-referencing FK.
- Client-side preview parse gives instant feedback before the network trip.

---

## 8. Canvas & Layout Engine (Algorithms)

Implemented in [src/lib/canvas/layoutEngine.ts](src/lib/canvas/layoutEngine.ts).

### Visual model (LeanIX-style placemat)
```
┌── L0 (coloured band, spans children) ──────────────────────┐
│  ┌ L1 column ┐  ┌ L1 column ┐  ┌ L1 column ┐              │
│  │ L1 header │  │ L1 header │  │ L1 header │              │
│  │  ┌ L2 ─┐  │  │  ┌ L2 ─┐  │  │  ┌ L2 ─┐  │              │
│  │  │ L3s │  │  │  │ L3s │  │  │  │ L3s │  │              │
│  │  └─────┘  │  │  └─────┘  │  │  └─────┘  │              │
│  └───────────┘  └───────────┘  └───────────┘              │
└────────────────────────────────────────────────────────────┘
```

### Constants (px)
`L1_COL_W=280`, `L1_COL_GAP=16`, `L0_BAND_H=50`, `L0_GROUP_GAP=32`, `L1_HDR_H=48`, `L1_PAD=10`, `L2_HDR_BASE=36`, `L2_HDR_LINE=18`, `L2_PAD=6`, `ROW_H=44`, `ROW_GAP=3`, `L2_GROUP_GAP=8`, `L1_MAX_H=640`, `MAX_SUBCOLS=3`.

### Core algorithm
1. Build tree from flat `Capability[]` by scanning once and pushing children into their parent's `children[]` (single O(n) pass). Sort siblings by `sort_order`.
2. Recursively **measure** heights bottom-up:
   - `measureL2Height(l2)` = header height (based on text length → line count) + L3 rows.
   - `measureL1(l2s)` = sum of L2 heights + gaps.
3. **Auto-split tall L1 columns** (`planL1Layout`, added 2026-09-22):
   - If a single-column body would exceed `L1_MAX_H`, distribute L2 groups across up to `MAX_SUBCOLS` sub-columns using a **greedy newspaper-column fill** — assign each L2 to the currently shortest sub-column, keeping every L2 intact.
   - Result: per-L1 `{ numCols, columns, width, height }` plan used for x-positioning.
4. Layout pass:
   - X: cumulative L1 width across L0 groups + `L0_GROUP_GAP` between L0s.
   - Y: L0 band on top, L1 header, then stacked L2/L3 rows.
5. **Hierarchical numbering** — walk from leaf to root, pushing the sibling index at each level except L0 (spec changed 2026-09-22: L0 no number, L1=1, L2=1.1, L3=1.1.1). Same walk is duplicated (kept in sync) in `promptBuilder.getNumber`, `transform/route.getCapabilityNumber`, and `dragDropHandler.getCapabilityNumber`.
6. Per-L0 color palette (10-entry cycle) → each L0 group + its descendants inherit a colour theme unless overridden by legend/style categories.

### Drag & drop rules
[src/lib/canvas/dragDropHandler.ts](src/lib/canvas/dragDropHandler.ts) enforces the invariant *parent.level = child.level − 1* and recomputes numbers after every drop. Same-level nesting is rejected.

---

## 9. Command System — AI-Driven Diagram Edits

Everything the AI (or the transcript pipeline) can do to a diagram is expressed as a **typed command DSL** — a small, closed set of JSON objects.

### Command types
Defined in [src/lib/commands/index.ts](src/lib/commands/index.ts):

| Command | Effect |
|--------|--------|
| `SET_STYLE` | Change background fill and/or border colour |
| `SET_TEXT_COLOR` | Change label text colour |
| `SET_NOTE` | Attach a text note to a node |
| `SET_DESCRIPTION` | Update description |
| `RENAME_NODE` | Rename a capability |
| `REPARENT_NODE` | Move node under a new parent (strict level check) |
| `DELETE_NODE` | Delete node (+ optionally re-parent its children) |
| `ADD_NODE` | Create a new node with `tempId`, `parentId`, `level`, `name` |
| `RESET_STYLE` | Clear fill / border / text colour overrides |
| `SET_LEGEND` | Create or update a legend entry (`slot`, `entryId`, `label`, `color`) |
| `REMOVE_LEGEND` | Delete a legend entry |

### Prompt builder ([`buildCommandPrompt`](src/lib/commands/promptBuilder.ts))
Renders (a) the full command schema as the system prompt, (b) the current diagram as an indented tree with hierarchical numbers, (c) the current legend, and (d) the AI chat history. The prompt bakes in **hard rules** ("never refuse a style request", "auto-create legend entries", "reparent must be exactly one level up") to eliminate common LLM failure modes.

### Executor ([`executeCommands`](src/lib/commands/executor.ts))
1. `normalizeCommandNodeIds()` — walks `ADD_NODE` commands, replaces any placeholder / colliding `tempId` with `crypto.randomUUID()`, and remaps every downstream reference. This is a defence against LLMs returning fake-looking IDs like `new-node-uuid`.
2. Applies each command to a *copy* of the capabilities array:
   - Structural commands (`RENAME`, `REPARENT`, `ADD`, `DELETE`) mutate the tree.
   - Visual commands (`SET_STYLE`, `SET_TEXT_COLOR`, `SET_NOTE`, `RESET_STYLE`) accumulate into a `nodePatches` map that the dashboard merges into React Flow `node.data`.
3. Validates each command; unresolvable references push into `errors[]` instead of throwing so partial progress is preserved.

### Why a DSL instead of "let the LLM edit JSON"
- **Schema-bounded** — the model can only emit commands the executor accepts.
- **Deterministic replay** — the same command array applied twice produces the same state, which makes undo/redo, transcript proposals, and audit logs trivial.
- **Composable** — legend + style commands can be batched atomically.

---

## 10. Meeting Transcript Pipeline (3-Pass LLM)

Implemented in [src/lib/transcript/pipeline.ts](src/lib/transcript/pipeline.ts) and passes 1–3.

### Overview
```
DOCX / VTT / paste
    │
    ▼
cleanTranscript()         ← strip WEBVTT timestamps, speaker tags, whitespace
    │
    ▼
Pass 1  pass1Filter()     ← gpt-4.1-mini, JSON mode
    │   Keep only capability/business content, drop small talk
    ▼
Pass 2  pass2Extract()    ← gpt-4.1-mini, JSON mode
    │   Mode A: new_diagram → returns { nodes[], commands[] }
    │   Mode B: edit_diagram → returns { commands[] } against existing tree
    ▼
Pass 3  pass3Todos()      ← extract action items / TODOs from filtered text
    │
    ▼
Proposals persisted (transcript_proposals), user reviews in modal
    │
    ▼
On accept: proposals → executeCommands() → diagram updated
```

### State machine
Progress and status are persisted in `meeting_transcripts` (`status`, `progress`, `current_step`, `error_message`) and streamed to the client via Server-Sent Events (SSE) using the `emit()` callback — no polling required.

### Key techniques
- **Response format `json_object`** on OpenAI + retry with stricter instruction if parse fails.
- **Context propagation** — an optional `context_prompt` from the user is threaded through Pass 1 and Pass 2 so the model knows domain-specific vocabulary and colour rules.
- **YAML-style capability rendering** (`capsToYaml`) for compact context injection in edit mode.
- **Provenance** — each extracted node carries `confidence ∈ [0,1]` and a `sourceQuote` back to the transcript for user validation.
- **Mixed proposals** — Pass 2 returns both `nodes[]` (structural additions) AND `commands[]` (SET_LEGEND / SET_STYLE / SET_TEXT_COLOR) so the review UI can show categories and assignments side-by-side.
- **Temp-ID remapping** — when the user accepts proposals, `tempId → real uuid` mapping is applied to all follow-on commands before the executor runs.

---

## 11. Capability Style Categories (Legend System)

Migrated in `scripts/migrations/2026-08-05_capability_style_categories.sql`.

### Concept
Every catalog owns a set of **style categories** — reusable labelled colours (e.g. "We Have" → #4CAF50, "Gap" → #F44336). A capability points to a category by FK, not by a raw hex; recolouring a category recolours every capability referencing it in one write.

### Composite-FK enforcement
```sql
CONSTRAINT capabilities_fill_category_fkey
  FOREIGN KEY (catalog_id, fill_category_id)
  REFERENCES public.capability_style_categories(catalog_id, id)
```
Guarantees a category and the capability using it belong to the **same catalog** — enforced by the database, not application code.

### Dual-read
For backward compatibility with pre-migration diagrams, runtime code (`capabilityStyles.server.ts`) reads *both* the legacy `node_styles` jsonb blob and the new category tables, with **legacy taking priority** (higher override). New writes populate both to keep old exports valid — a classic **strangler-fig migration pattern**.

### Template cloning
When a diagram is saved as a template and later cloned, category IDs are **remapped** so the clone owns fresh rows, then every capability's `*_category_id` is rewritten through the mapping — preserving colour semantics without leaking references to the source catalog.

---

## 12. State Management (Zustand)

`src/stores/catalogStore.ts` — a single store that owns the entire in-flight diagram.

### Slice shape (abridged)
```ts
{
  catalogId, catalogName, tags, industry,
  capabilities: Capability[],
  nodeStyles: Record<id, NodeStylePatch>,
  styleCategories: CapabilityStyleCategory[],
  legend: { fill[], border[], textColor[] },
  isDirty: boolean,
  // actions
  setCatalog, loadFromDB, markSaved,
  renameCatalog, setTags,
  addCapability, deleteCapability, reparentCapability,
  applyCommands, setLegendEntry, removeLegendEntry,
  undo, redo, snapshot
}
```

### Persist middleware
Wrapped with Zustand's `persist` writer (localStorage). `version: 4` was bumped when `tags` was added, with a `migrate()` function that back-fills `tags: []` for older cached stores — a safe schema-evolution pattern for client state.

### Local-first principle
Every canvas mutation goes through the store; **the DB is only touched on explicit Apply / Save**. This eliminates hundreds of writes during drag operations, keeps UX snappy, and makes undo/redo trivial (each mutation pushes a snapshot to `undoStack`).

---

## 13. Authentication, RBAC & Middleware

### Session layer
- **Supabase Auth** with `@supabase/ssr`. Cookies persist across pages.
- `src/middleware.ts` runs on every non-public request: rebuilds a `createServerClient`, calls `supabase.auth.getUser()` to refresh the token, and redirects to `/login` if unauthenticated.
- `PUBLIC_ROUTES = ["/login", "/api/auth", "/auth/signin", "/"]` plus static-asset paths bypass the guard.

### RBAC ([src/lib/auth/authorization.ts](src/lib/auth/authorization.ts))
Three roles, resolved per-catalog:

| Role | Rights |
|------|--------|
| `admin` | View + edit + archive + share |
| `editor` | View + edit |
| `viewer` | View only |

`getCatalogAccess(catalogId, userId)` returns `{ userRole, isOwner, clientId }` by joining `capability_catalogs.client_id` with the user's role in that client folder. Personal (client-less) diagrams grant the owner implicit `admin`. `isPlatformAdmin(userId)` checks a global admin table for cross-tenant privilege.

Every API route calls `canView` / `canEdit` / `canArchive` before mutating.

### Audit ([src/lib/auth/audit.ts](src/lib/auth/audit.ts))
Sensitive actions (share change, role change, archive, restore) are written to an audit log for compliance.

---

## 14. Versioning & Save Semantics

- Every Apply inserts a new `visual_maps` row and marks it `is_active=true`, deactivating the previous version — **immutable history**.
- `/api/catalogs/versions/[id]` lists history; `/api/catalogs/restore/[id]` re-activates an older version.
- `chat_history` and `node_styles` live on the catalog row itself so restoring a version does not lose the conversation.
- Auto-draft: unsaved edits are held only in Zustand + localStorage until the user Applies, so a browser refresh restores in-progress work without ever creating a bad DB row.

---

## 15. Export Subsystem

`src/app/(routes)/export/page.tsx` + `src/components/export/*` produce artefacts fully client-side:

| Format | Library | Method |
|--------|---------|--------|
| PNG | `html-to-image` | `toPng(nodeRef, { pixelRatio: 2 })` for 2× sharpness |
| SVG | `html-to-image` | `toSvg(...)` |
| PDF | `jsPDF` | wraps PNG bytes at true canvas dimensions |
| PPTX | `pptxgenjs` | one slide per L0 group |
| JSON | native | full `{ catalog, capabilities, styles, legend }` |
| CSV / XLSX | `xlsx` | flat rows for downstream tooling |
| ZIP | `archiver` | streams a bundle of the above |

The 2×-DPR PNG capture is the same pipeline used for presentation screenshots and share previews.

---

## 16. AI / LLM Layer

### Providers wired
- **OpenAI** (`openai` SDK) — production default. Models: `gpt-4.1-mini` (transcript filtering + extraction) and `gpt-4.1` for chat edits when higher reasoning is required.
- **Anthropic Claude Sonnet** (`@anthropic-ai/sdk`) — optional alternate for the same command-DSL flow.
- **Gemini** — configurable third provider.
- Provider scaffolding sits under `src/lib/ai/{llm,slm,orchestrator,embeddings}/` for a future orchestrator that routes tasks by complexity.

### Prompt-engineering patterns
- **JSON-mode enforcement** via `response_format: { type: "json_object" }` on every structured call.
- **System prompt = schema + hard rules + current state**. See `buildCommandPrompt`, `buildSuggestionPrompt`, `buildChatPrompt`.
- **Retry with stricter instructions** on parse failure (Pass 1, Pass 2) — a cheap self-healing loop.
- **Number/ID references** — the prompt injects hierarchical numbers ("1.6.1") next to every node so users can reference nodes conversationally; `/api/transform` rewrites those references back to UUIDs before the executor runs (regex allows `{0,2}` dot-groups after a single-segment L1).

### Cost observability
Every LLM call (`/api/transform`, transcript passes, chat) appends to `ai_usage_log` with `model`, `mode`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd`. A read-only dashboard (`public/usage-dashboard.html`) visualises this — no separate telemetry service required.

---

## 17. Security Model

| Concern | Mitigation |
|---------|-----------|
| API-key leakage | All LLM & service-role calls run **server-side only**. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the browser. |
| Session hijack | httpOnly, secure Supabase cookies via `@supabase/ssr`. Middleware refreshes tokens on every request. |
| Cross-catalog data leak | Composite FK `(catalog_id, id)` on style categories + `getCatalogAccess` gate on every route. |
| Prompt injection | LLM output is never `eval`ed; it must pass the command schema and node-existence checks in `executeCommands`. Unknown commands fall through the switch and are ignored. |
| Duplicate uploads | `findDuplicateCatalog` compares row count + L0 name set before insertion. |
| Race on IDs | LLM temp-ID collisions are re-mapped to `crypto.randomUUID()` prior to apply. |
| SQL injection | All queries go through the Supabase parameterised client; no string concatenation. |
| Excessive AI cost | `ai_usage_log` + admin dashboard; rate-limiting hooks live in `/api/usage-stats`. |
| Destructive actions | Archive/restore instead of hard-delete for catalogs; capabilities use soft `is_deleted`. |

---

## 18. Performance Techniques

- **Local-first editing** — hundreds of drag/rename ops with **zero** network chatter.
- **O(n) tree build** in the layout engine (single pass, `Map<id, node>` lookup).
- **Height memoisation** during measurement — every subtree measured exactly once.
- **Greedy newspaper-fill** for auto-splitting tall L1 columns keeps the diagram compact without a full 2-D bin-packer.
- **Level-by-level DB inserts** using a `pathToId` map — resolves parent FKs without extra reads.
- **Background inserts** — catalog row returned immediately, capabilities inserted after response so the user hits the canvas fast.
- **JSON-mode LLM calls** — no regex-parsing markdown code fences at runtime.
- **`pixelRatio: 2`** capture only at export time (not during editing).
- **Zustand `persist`** with schema versioning avoids redundant server fetches on refresh.
- **Composite FK + partial dual-read** during style-category migration — zero downtime.

---

## 19. Skills Demonstrated

Reading this document end-to-end, the concrete engineering skills exercised in the codebase are:

- **Full-stack TypeScript / Next.js 14 (App Router)** — server components, route groups, middleware, API routes.
- **Relational schema design** — self-referencing trees, composite FKs, JSONB hybrid columns, dated SQL migrations.
- **Postgres (Supabase)** — RLS-ready design, `text[]` tags, check constraints, `gen_random_uuid()`, audit patterns.
- **Auth & RBAC** — cookie-based sessions, per-tenant role resolution, platform-admin escalation, audit logging.
- **State management** — Zustand with `persist`, versioned migrations, dirty tracking, undo/redo stacks.
- **Interactive graphics** — React Flow custom nodes, drag/drop, live layout re-computation, greedy column-balancing algorithm.
- **Algorithm design** — bottom-up tree measurement, hierarchical numbering walk, path-based ID resolution, greedy column packing.
- **LLM engineering** — typed command DSL, JSON-mode prompting, self-healing retries, provenance/confidence, temp-ID normalisation, chat-history threading, cost logging.
- **Pipeline orchestration** — multi-pass transcript pipeline with persisted state machine + SSE progress streaming.
- **File processing** — SheetJS (Excel/CSV wide + tall shapes), mammoth (DOCX), VTT cleaner.
- **Export engineering** — html-to-image → PNG/SVG, jsPDF, pptxgenjs, xlsx, archiver.
- **Migration strategy** — strangler-fig dual-read of legacy `node_styles` alongside new category tables; template-clone remapping.
- **Security discipline** — server-only secrets, schema-bounded LLM output, composite-FK isolation, soft deletes.
- **Observability** — persisted AI usage log + standalone dashboard, transcript progress, versioned visual maps.
- **Deployment portability** — same build runs on localhost, Vercel, and Render because the app uses only relative API paths and env vars.

---

*This document is the single source of truth for onboarding, code review, and technical interviews. Every section maps directly to concrete files under `src/`; follow the linked paths to see the implementation.*

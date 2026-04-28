# Visual Placemat — MVP Architecture

**Version:** 0.1.2  
**Last Updated:** April 28, 2026  
**Stack:** Next.js 14 · React 18 · TypeScript · Supabase · React Flow · Tailwind CSS

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Frontend Layer](#frontend-layer)
4. [API Layer](#api-layer)
5. [Business Logic Layer](#business-logic-layer)
6. [Data Layer](#data-layer)
7. [Type System](#type-system)
8. [Data Flow](#data-flow)
9. [Project Structure](#project-structure)
10. [Technology Stack](#technology-stack)
11. [Implementation Status](#implementation-status)
12. [Planned (Post-MVP)](#planned-post-mvp)

---

## Overview

Visual Placemat is a tool for uploading capability catalogs (Excel/CSV files with L0–L3 hierarchical columns) and generating interactive visual capability maps. The MVP focuses on the core upload → parse → visualize → edit pipeline.

### Core MVP Flow

```
Upload Excel/CSV  →  Parse Hierarchy  →  Store in Supabase  →  Render on Canvas  →  Edit Nodes
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                        │
│                                                                  │
│  ┌────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ Landing    │  │ Upload Page      │  │ Dashboard (Canvas)   │ │
│  │ page.tsx   │  │ /documents       │  │ /dashboard           │ │
│  │            │  │                  │  │                      │ │
│  │ • Hero     │  │ • Drag & drop   │  │ • React Flow canvas  │ │
│  │ • Entry    │  │ • XLSX parse    │  │ • CapabilityNode     │ │
│  │   cards    │  │ • Validation    │  │ • LeftSidebar        │ │
│  │ • How it   │  │ • Preview table │  │ • RightSidebar       │ │
│  │   works    │  │                  │  │ • CanvasToolbar      │ │
│  └────────────┘  └──────────────────┘  └──────────────────────┘ │
│                                                                  │
│  ┌────────────┐  ┌──────────────────┐                           │
│  │ Export     │  │ Shared Layout    │                           │
│  │ /export    │  │ Navbar + Footer  │                           │
│  │ (UI only)  │  │                  │                           │
│  └────────────┘  └──────────────────┘                           │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP (fetch)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    API LAYER (Next.js API Routes)                │
│                                                                  │
│  ┌─────────────────────┐  ┌──────────────────────┐              │
│  │ POST /api/documents │  │ GET /api/capabilities │              │
│  │ GET  /api/documents │  │   ?catalogId=...      │              │
│  └─────────┬───────────┘  └───────────┬──────────┘              │
│            │                          │                          │
│  ┌─────────┴──────────────────────────┴──────────┐              │
│  │            BUSINESS LOGIC                      │              │
│  │  ┌──────────────────┐  ┌────────────────────┐ │              │
│  │  │ excelParser.ts   │  │ layoutEngine.ts    │ │              │
│  │  │ (SheetJS)        │  │ (React Flow nodes) │ │              │
│  │  └──────────────────┘  └────────────────────┘ │              │
│  └───────────────────────────────────────────────┘              │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Supabase SDK
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Supabase / PostgreSQL)            │
│                                                                  │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │ capability_catalogs  │  │ capabilities                    │  │
│  │ (catalog metadata)   │──│ (L0–L3 hierarchy, parent_id)   │  │
│  └──────────────────────┘  └─────────────────────────────────┘  │
│                                                                  │
│  Tables with schema only (not yet used by MVP):                  │
│  visual_maps · diff_history · capability_chunks                  │
│  prompt_sessions · catalog_shares                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Frontend Layer

### Pages

| Route | File | Status | Description |
|-------|------|--------|-------------|
| `/` | `src/app/page.tsx` | ✅ Implemented | Landing page — hero, entry cards, recent diagrams, how-it-works |
| `/documents` | `src/app/(routes)/documents/page.tsx` | ✅ Implemented | Excel/CSV upload with drag-and-drop, client-side parsing, format validation, preview table |
| `/dashboard` | `src/app/(routes)/dashboard/page.tsx` | ✅ Implemented | React Flow canvas — interactive capability map with sidebar editing |
| `/export` | `src/app/(routes)/export/page.tsx` | 🟡 UI only | Export options menu (PNG, SVG, PDF, JSON, CSV) — no backend wired |
| `/transform` | `src/app/(routes)/transform/` | ❌ Placeholder | AI-powered transformation (empty `.gitkeep`) |

### Components

#### Canvas (`src/components/canvas/`)

| Component | Purpose |
|-----------|---------|
| `CanvasToolbar.tsx` | Zoom in/out, fit-to-view controls using React Flow API |
| `CapabilityNode.tsx` | Custom React Flow node — 4-level color theming (L0–L3), selection state, handles |
| `LeftSidebar.tsx` | Layer visibility toggles (L0–L3), template info display |
| `RightSidebar.tsx` | Node property inspector — edit color, border, notes for selected node |

#### UI (`src/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `EntryCards.tsx` | Three entry-point cards linking to `/documents`, `/transform`, `/dashboard` |
| `HowItWorks.tsx` | Four-step process flow with gradient badges and connector line |
| `RecentDiagrams.tsx` | Recent maps section (static/mock data) |

#### Layout (`src/components/layout/`)

| Component | Purpose |
|-----------|---------|
| `Navbar.tsx` | Responsive top navigation — brand logo, links, mobile menu, sign-in button |
| `Footer.tsx` | Page footer with links and copyright |

---

## API Layer

All API routes live under `src/app/api/` using Next.js file-based routing.

### Implemented Endpoints

#### `POST /api/documents`

Handles file upload and processing:

1. Accepts `multipart/form-data` with `.xlsx` or `.csv` file
2. Parses file using `excelParser.ts` (SheetJS)
3. Checks for duplicate catalogs (by row count + L0 names)
4. Creates catalog record immediately (fast response)
5. Inserts capabilities in background (level-by-level L0→L1→L2→L3)
6. Returns `{ catalogId }` for redirect to dashboard

#### `GET /api/documents`

Returns all capability catalogs.

#### `GET /api/capabilities?catalogId=<uuid>`

Returns all capabilities for a given catalog, ordered for canvas rendering.

### Stubbed Endpoints (Return 501)

| Endpoint | Planned Purpose |
|----------|-----------------|
| `/api/auth` | User authentication |
| `/api/embeddings` | Vector embedding generation |
| `/api/export` | File export (PNG, PDF, etc.) |
| `/api/graph` | Neo4J graph operations |
| `/api/transform` | AI-driven capability transformation |

---

## Business Logic Layer

### Excel Parser (`src/lib/parser/excelParser.ts`)

**Function:** `parseCapabilityCatalog(buffer: ArrayBuffer)`

Core parsing logic for uploaded spreadsheets:

- Reads Excel/CSV buffer using XLSX library
- Detects "Capability Catalog" sheet or defaults to first sheet
- Finds L0–L3 column indices via regex header matching
- Builds parent-child hierarchy preserving row order
- Validates that at least L0 column exists
- **Returns:** `ParsedCapabilityRow[]` with fields: `l0`, `l1`, `l2`, `l3`, `description`

### Layout Engine (`src/lib/canvas/layoutEngine.ts`)

**Function:** `buildCanvasNodes(capabilities, visibleLevels)`

Converts flat capability data into positioned React Flow nodes:

- Builds hierarchical numbering (1, 1.1, 1.1.1, etc.)
- Calculates pixel positions for 4-level visual hierarchy
- L0 nodes span as headers across all child L1 columns
- L1–L3 arranged in nested columns with dynamic sizing
- Filters nodes by currently visible levels
- **Returns:** `Node<CapabilityNodeData>[]` ready for React Flow

### Placeholder Modules (Empty)

| Module | Path | Planned Purpose |
|--------|------|-----------------|
| Context Builder | `src/lib/context-builder/` | Aggregate data context for LLM prompts |
| Diff Normalizer | `src/lib/diff-normalizer/` | Clean and normalize LLM output |
| Diff Validator | `src/lib/diff-validator/` | Validate LLM output against Zod schemas |
| LLM Output Handler | `src/lib/llm-output-handler/` | Process and route LLM responses |
| Auth | `src/lib/auth/` | Authentication utilities |

---

## Data Layer

### Database: Supabase (PostgreSQL)

**Client setup:** `src/lib/db/postgres/client.ts`

Two Supabase clients initialized:

| Client | Key | Purpose |
|--------|-----|---------|
| `supabase` | Anon key | Client-side, subject to Row-Level Security |
| `supabaseAdmin` | Service role key | Server-side, bypasses RLS |

### Database Operations (`src/lib/db/postgres/capabilities.ts`)

| Function | Description |
|----------|-------------|
| `findDuplicateCatalog(rows)` | Dedup check by row count + L0 names |
| `createCatalog(name, opts)` | Single INSERT into `capability_catalogs`, returns `catalogId` |
| `insertCapabilitiesForCatalog(catalogId, rows)` | Level-by-level INSERT (L0→L1→L2→L3) with parent_id resolution via `pathToId` map |
| `getCatalogCapabilities(catalogId)` | Fetch all capabilities for canvas rendering |

### Schema (`src/lib/db/postgres/schema.sql`)

**7 tables total — 2 actively used in MVP:**

| Table | MVP Status | Purpose |
|-------|------------|---------|
| `capability_catalogs` | ✅ Active | Catalog metadata — user_id, name, client, industry, status |
| `capabilities` | ✅ Active | L0–L3 hierarchy — parent_id self-reference, sort_order, source |
| `visual_maps` | Schema only | React Flow layout snapshots with versioning |
| `diff_history` | Schema only | Audit log for AI-prompted changes |
| `capability_chunks` | Schema only | RAG knowledge base with pgvector embeddings |
| `prompt_sessions` | Schema only | AI prompt observability and latency tracking |
| `catalog_shares` | Schema only | Multi-user sharing with viewer/editor/owner roles |

### Capability Hierarchy (Parent-Child Chain)

```
L0  (parent_id = null)      — Domain
 └─ L1  (parent_id → L0)    — Area
     └─ L2  (parent_id → L1) — Capability
         └─ L3  (parent_id → L2) — Sub-capability
```

### Placeholder Data Stores (Empty)

| Store | Path | Planned Purpose |
|-------|------|-----------------|
| Redis | `src/lib/db/redis/` | Caching hot data, session state |
| Neo4J | `src/lib/db/neo4j/` | Graph relationships and traversal |
| Vector | `src/lib/db/vector/` | pgvector similarity search utilities |

---

## Type System

**File:** `src/types/capability.ts`

| Type | Description |
|------|-------------|
| `CapabilityCatalog` | Catalog metadata (id, user_id, name, industry, status) |
| `Capability` | Single node (id, catalog_id, parent_id, level, name, description) |
| `VisualMap` | Layout snapshot (layout_data as JSONB, version_number) |
| `DiffHistory` | Change audit record (prompt_text, diff_payload, model_used) |
| `CapabilityChunk` | RAG embedding entry (label, industry, embedding vector) |
| `PromptSession` | AI prompt tracking (model, latency, retry count) |
| `CatalogShare` | Sharing permission (catalog_id, user_id, role) |
| `ParsedCapabilityRow` | Parser output (l0, l1, l2, l3, description) |

---

## Data Flow

### Implemented Path (Upload → Canvas)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User uploads .xlsx/.csv on /documents                    │
│    └─ Client-side: XLSX.read() validates format             │
│    └─ Shows preview table + green/red validation banner     │
│                                                             │
│ 2. User clicks "Continue to Canvas →"                       │
│    └─ POST /api/documents (FormData with file)              │
│    └─ Server: excelParser.parseCapabilityCatalog(buffer)    │
│    └─ Server: createCatalog() → returns catalogId           │
│    └─ Background: insertCapabilitiesForCatalog()            │
│                                                             │
│ 3. Redirect to /dashboard?catalogId=<uuid>                  │
│    └─ GET /api/capabilities?catalogId=<uuid>                │
│    └─ Client: buildCanvasNodes(capabilities, visibleLevels) │
│    └─ React Flow renders interactive capability map         │
│                                                             │
│ 4. User edits nodes via RightSidebar                        │
│    └─ Changes applied to local state only (not persisted)   │
└─────────────────────────────────────────────────────────────┘
```

### Client-Side Parsing (Upload Page)

The upload page performs dual parsing:

1. **Browser-side** (immediate feedback): XLSX.read() parses the file for preview and format validation — checks for L-level column headers
2. **Server-side** (on submit): `excelParser.ts` re-parses the file for canonical data extraction and database insertion

---

## Project Structure

```
src/
├── app/
│   ├── globals.css              # Tailwind directives, Inter font, global styles
│   ├── layout.tsx               # Root layout with Navbar
│   ├── page.tsx                 # Landing page
│   ├── (routes)/
│   │   ├── dashboard/page.tsx   # React Flow canvas editor
│   │   ├── documents/page.tsx   # File upload & parsing
│   │   ├── export/page.tsx      # Export options (UI only)
│   │   └── transform/           # Planned AI transform page
│   └── api/
│       ├── auth/route.ts        # Stub
│       ├── capabilities/route.ts # GET capabilities by catalog
│       ├── documents/route.ts   # POST upload, GET list
│       ├── embeddings/route.ts  # Stub
│       ├── export/route.ts      # Stub
│       ├── graph/route.ts       # Stub
│       └── transform/route.ts   # Stub
├── components/
│   ├── canvas/                  # CanvasToolbar, CapabilityNode, sidebars
│   ├── layout/                  # Navbar, Footer
│   └── ui/                      # EntryCards, HowItWorks, RecentDiagrams
├── lib/
│   ├── parser/excelParser.ts    # SheetJS-based Excel/CSV parser
│   ├── canvas/layoutEngine.ts   # Capability → React Flow node converter
│   └── db/postgres/
│       ├── client.ts            # Supabase client initialization
│       ├── capabilities.ts      # CRUD operations for catalogs & capabilities
│       ├── schema.sql           # Full 7-table schema
│       └── migration_mvp_v2.sql # Migration script
└── types/
    └── capability.ts            # All TypeScript type definitions
```

---

## Technology Stack

### Implemented in MVP

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js | 14.2 | Full-stack React framework with API routes |
| UI Library | React | 18.3 | Component-based UI |
| Language | TypeScript | 5.4 | Type safety across frontend and backend |
| Styling | Tailwind CSS | 3.4 | Utility-first CSS framework |
| Visualization | React Flow | 11.11 | Interactive node-based canvas |
| Spreadsheet | SheetJS (xlsx) | 0.18.5 | Excel/CSV parsing |
| Database | Supabase | 2.104 | Managed PostgreSQL + Auth SDK |
| Hosting | Vercel | — | Frontend deployment (implied by Next.js) |

### Planned (Not Yet Integrated)

| Category | Technology | Purpose |
|----------|-----------|---------|
| LLM | Claude Sonnet (Anthropic) | Complex capability transformations |
| SLM | Phi-3 (Microsoft) | Lightweight inference tasks |
| Embeddings | OpenAI Embedding API | Vector generation for RAG |
| Vector DB | pgvector | Similarity search on capability embeddings |
| Cache | Redis | Hot data caching, session management |
| Graph DB | Neo4J | Relationship traversal and path queries |
| Validation | Zod | Schema validation for LLM output |
| State Mgmt | Zustand | Client-side state management |

---

## Implementation Status

### ✅ Fully Implemented

- **Landing page** — Hero section, entry cards, recent diagrams, how-it-works flow
- **File upload** — Drag-and-drop with client-side validation, format detection, preview table
- **Excel/CSV parsing** — L0–L3 hierarchy extraction with parent-child resolution
- **Database layer** — Supabase schema (7 tables), catalog CRUD, level-by-level capability insertion
- **Canvas visualization** — React Flow with custom node rendering, 4-level color theming
- **Canvas editing** — Node selection, property editing (color, border, notes) via sidebar
- **Canvas controls** — Zoom, pan, fit-to-view toolbar
- **Navigation** — Responsive navbar, route linking between pages

### 🟡 Partial / UI Only

- **Export page** — UI presents export options but no backend logic
- **Recent diagrams** — Static/mock data, not connected to database

### ❌ Not Yet Implemented

- Authentication & authorization (Supabase Auth)
- AI/LLM integration (Claude, Phi-3)
- RAG pipeline (embeddings, vector search, context building)
- Diff tracking (normalizer, validator, history)
- Multi-user sharing (catalog_shares table exists but unused)
- Canvas state persistence (edits are client-side only)
- Real export functionality (PNG, SVG, PDF, JSON, CSV)
- State management library (Zustand)
- Caching layer (Redis)
- Graph database (Neo4J)

---

## Planned (Post-MVP)

### Phase 2 — AI Integration

- Wire Claude Sonnet API for capability transformation prompts
- Build context aggregator to enrich prompts with catalog data
- Implement diff normalizer/validator pipeline for LLM output
- Add prompt session logging for observability

### Phase 3 — RAG & Embeddings

- Generate OpenAI embeddings on capability ingestion
- Populate `capability_chunks` table with industry-tagged vectors
- Enable similarity search for related capabilities across catalogs
- Build pgvector indexes for fast cosine similarity queries

### Phase 4 — Persistence & Collaboration

- Save canvas edits to `visual_maps` table with versioning
- Implement `catalog_shares` for multi-user access (viewer/editor/owner)
- Add Supabase Auth for user management and RLS enforcement
- Build diff history tracking for undo/redo support

### Phase 5 — Export & Polish

- Implement real export to PNG, SVG, PDF, JSON, CSV, Excel
- Add Redis caching for frequently accessed catalogs
- Connect Neo4J for graph-based relationship queries
- Integrate Zustand for structured client-side state management

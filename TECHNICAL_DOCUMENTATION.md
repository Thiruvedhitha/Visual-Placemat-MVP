# Visual Placemat MVP — Complete Technical Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [API Routes Reference](#6-api-routes-reference)
7. [AI/LLM Integration](#7-aillm-integration)
8. [Command System](#8-command-system)
9. [Transcript Processing Pipeline](#9-transcript-processing-pipeline)
10. [Canvas & Layout Engine](#10-canvas--layout-engine)
11. [Data Import (Excel Parser)](#11-data-import-excel-parser)
12. [State Management](#12-state-management)
13. [Export Capabilities](#13-export-capabilities)
14. [Client/Multi-Tenancy System](#14-clientmulti-tenancy-system)
15. [Version Control & Snapshots](#15-version-control--snapshots)
16. [Deployment & Environment](#16-deployment--environment)

---

## 1. Project Overview

**Visual Placemat MVP** is a web application for creating, editing, and managing hierarchical **Business Capability Maps** (visual placemats). It allows users to:

- Import capability hierarchies from Excel/CSV files
- Visualize them as interactive LeanIX-style nested diagrams on a canvas
- Edit diagrams via natural language AI commands
- Process meeting transcripts to auto-generate or modify capability maps
- Collaborate through client folders with role-based access
- Export diagrams to PDF, PowerPoint, and images
- Version and restore diagram snapshots

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | ^14.2.0 | Full-stack React framework (App Router) |
| **React** | ^18.3.0 | UI library |
| **TypeScript** | ^5.4.0 | Type-safe JavaScript |
| **Tailwind CSS** | ^3.4.3 | Utility-first CSS styling |
| **ReactFlow** | ^11.11.4 | Interactive node-based canvas rendering |
| **Zustand** | ^5.0.12 | Client-side state management (with persistence) |

### Backend / API
| Technology | Purpose |
|---|---|
| **Next.js API Routes** | Serverless backend (Route Handlers in App Router) |
| **OpenAI SDK** | ^6.36.0 — GPT-4.1-mini for transform/chat/transcript AI |
| **Anthropic SDK** | ^0.93.0 — Reserved for Claude integration (future) |

### Database & Auth
| Technology | Purpose |
|---|---|
| **Supabase (PostgreSQL)** | Primary database, auth, Row Level Security |
| **@supabase/ssr** | ^0.12.4 — Server-side Supabase client with cookie-based sessions |
| **@supabase/supabase-js** | ^2.104.0 — Client SDK |

### File Processing & Export
| Technology | Purpose |
|---|---|
| **xlsx** | ^0.18.5 — Excel/CSV parsing and generation |
| **mammoth** | ^1.12.0 — DOCX parsing (transcript uploads) |
| **pptxgenjs** | ^4.0.1 — PowerPoint generation |
| **jspdf** | ^4.2.1 — PDF generation |
| **html-to-image** | ^1.11.13 — Canvas screenshot to PNG/JPEG |
| **file-saver** | ^2.0.5 — Browser file download |

### Infrastructure (Planned)
| Technology | Purpose |
|---|---|
| **Neo4j** | Graph database for capability relationships (scaffolded, not yet active) |
| **Redis** | Caching layer (scaffolded, not yet active) |
| **Vector DB** | Embeddings storage for semantic search (scaffolded, not yet active) |
| **Docker** | Containerization (scaffolded) |

### Dev Tooling
| Tool | Purpose |
|---|---|
| **PostCSS** | CSS processing pipeline |
| **Autoprefixer** | Browser compatibility |
| **dotenv** | Environment variable management |
| **archiver** | ZIP archive creation (dev scripts) |

---

## 3. Architecture

### Directory Structure

```
src/
├── app/                     # Next.js App Router
│   ├── (routes)/            # Page routes (grouped layout)
│   │   ├── clients/         # Client folder management UI
│   │   ├── dashboard/       # Main diagram editor canvas
│   │   ├── documents/       # Document management
│   │   ├── export/          # Export page
│   │   ├── login/           # Auth login page
│   │   ├── transform/       # Upload & transform page
│   │   ├── view/            # Read-only diagram viewer
│   │   └── works/           # "My Works" / catalog listing
│   ├── api/                 # API Route Handlers
│   │   ├── auth/            # Authentication endpoints
│   │   ├── capabilities/    # CRUD for capabilities
│   │   ├── catalogs/        # Catalog CRUD, save, versions, restore, templates
│   │   ├── chat/            # Chat history persistence
│   │   ├── clients/         # Client folder management
│   │   ├── documents/       # Document endpoints
│   │   ├── embeddings/      # Vector embeddings (stub)
│   │   ├── export/          # Export endpoints (stub)
│   │   ├── graph/           # Graph DB endpoint (stub)
│   │   ├── my-works/        # User's diagrams aggregation
│   │   ├── transcripts/     # Transcript CRUD + processing pipeline
│   │   ├── transform/       # AI transform (main AI endpoint)
│   │   └── usage-stats/     # AI cost/usage analytics
│   └── auth/                # Auth callback handling
├── components/
│   ├── canvas/              # Canvas components (AIMapEditor, CapabilityNode, etc.)
│   ├── export/              # Export UI components
│   ├── layout/              # App shell layout
│   ├── preview/             # Diagram preview
│   ├── transcript/          # Transcript upload/review UI
│   └── ui/                  # Shared UI primitives (Toast, etc.)
├── lib/
│   ├── ai/                  # AI module scaffolding (embeddings, llm, orchestrator, slm)
│   ├── auth/                # Authentication helpers (getUser)
│   ├── canvas/              # Layout engine + drag-drop handler
│   ├── commands/            # Command system (types, executor, prompt builder)
│   ├── context-builder/     # Context assembly (scaffolded)
│   ├── db/                  # Database clients
│   │   ├── postgres/        # Supabase/Postgres: client, schema, capabilities CRUD
│   │   ├── neo4j/           # Graph DB (scaffolded)
│   │   ├── redis/           # Cache (scaffolded)
│   │   └── vector/          # Vector store (scaffolded)
│   ├── diff-normalizer/     # Diff normalization (scaffolded)
│   ├── diff-validator/      # Diff validation (scaffolded)
│   ├── llm-output-handler/  # LLM response handling (scaffolded)
│   ├── parser/              # Excel/CSV parsing + row→capability conversion
│   └── transcript/          # Transcript processing pipeline (clean, filter, extract, apply)
├── middleware/              # Route middleware logic
├── store/                   # Additional stores (scaffolded)
├── stores/                  # Zustand stores (catalogStore)
├── types/                   # TypeScript type definitions
└── middleware.ts            # Next.js edge middleware (auth guard)
```

### Request Flow

```
Browser → Next.js Middleware (auth check via Supabase SSR)
       → API Route Handler
       → Service Layer (lib/)
       → Supabase PostgreSQL
       → Response (JSON / SSE stream)
```

### Client-Side Flow

```
User Action → Zustand Store Update → React Re-render
            → API Call (fetch) → Backend Processing
            → Store Update from Response → Canvas Re-render
```

---

## 4. Database Schema

### Core Tables

#### `capability_catalogs`
The root entity — represents a single diagram/map.

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK → auth.users) | Owner |
| client_id | uuid (FK → clients) | Optional client folder association |
| name | text | Catalog/diagram name |
| description | text | Optional description |
| client_name | text | Legacy client association / `__builtin__` for templates |
| industry | text | Industry tag |
| status | text | 'active' (default) |
| node_styles | jsonb | Per-node visual overrides `{ [nodeId]: { fill, border, textColor, note } }` |
| chat_history | jsonb | Persistent chat state `{ map: [], commits: [], sessions: [] }` |
| notes | text | Free-form notes |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

#### `capabilities`
Individual nodes in the capability hierarchy (tree structure via `parent_id`).

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| catalog_id | uuid (FK → capability_catalogs) | Parent catalog |
| parent_id | uuid (FK → capabilities, self-ref) | Tree parent (null = root/L0) |
| level | smallint | 0-3 (L0=domain, L1=group, L2=capability, L3=sub-capability) |
| name | text | Display name |
| description | text | Optional description |
| note | text | User/AI-attached note |
| sort_order | integer | Ordering among siblings |
| source | text | Origin: 'xlsx_import', 'ai_generated', 'transcript', 'manual' |
| is_deleted | boolean | Soft-delete flag |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

#### `visual_maps`
Version snapshots of a catalog's diagram state.

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| catalog_id | uuid (FK → capability_catalogs) | Owner catalog |
| name | text | Version label |
| version_number | integer | Sequential version |
| layout_data | jsonb | Full snapshot: `{ capabilities: [...], nodeStyles: {...} }` |
| is_active | boolean | Currently active version |
| thumbnail_url | text | Preview image URL |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

#### `diff_history`
Audit log of AI-driven changes.

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| catalog_id | uuid (FK) | Target catalog |
| applied_by | uuid (FK → auth.users) | Who triggered it |
| prompt_text | text | User's prompt |
| diff_payload | jsonb | Array of DiagramCommand objects |
| status | text | 'applied' (default) |
| model_used | text | AI model identifier |
| visual_map_id | uuid (FK → visual_maps) | Associated snapshot |
| created_at | timestamptz | Auto |
| applied_at | timestamptz | When applied |

#### `ai_usage_log`
Token and cost tracking for all AI API calls.

| Column | Type | Description |
|---|---|---|
| id | bigint (PK, identity) | Auto-generated |
| timestamp | timestamptz | When the call was made |
| model | text | Model used (e.g. 'gpt-4.1-mini') |
| mode | text | Operation type ('command', 'suggest', 'chat', 'filter', 'extract', 'todos') |
| prompt_tokens | integer | Input tokens consumed |
| completion_tokens | integer | Output tokens generated |
| total_tokens | integer | Sum of above |
| cost_usd | numeric | Calculated cost |

#### `capability_chunks`
Vector embeddings for semantic search (future RAG).

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| label | text | Capability name |
| level | text | Hierarchy level |
| industry | text | Industry context |
| content | text | Full text content |
| embedding | vector | pgvector embedding |
| source | text | Origin reference |
| source_catalog_id | uuid (FK) | Source catalog |
| created_at | timestamptz | Auto |

#### `prompt_sessions`
Audit trail of all AI prompts and their performance.

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| catalog_id | uuid (FK) | Context catalog |
| user_id | uuid (FK) | Who issued |
| prompt | text | Full prompt text |
| model_used | text | Model identifier |
| retry_count | smallint | Number of retries |
| validation_error | text | Any validation failure |
| latency_ms | integer | Response time |
| created_at | timestamptz | Auto |

### Multi-Tenancy Tables

#### `clients`
Client organization folders for grouping diagrams.

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| name | text | Client/org name |
| industry | text | Industry |
| description | text | Optional |
| logo_url | text | Logo |
| created_by | uuid (FK → auth.users) | Creator |
| created_at / updated_at | timestamptz | Auto |

#### `client_members`
RBAC membership table.

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| client_id | uuid (FK → clients) | Client folder |
| user_id | uuid (FK → auth.users) | Member |
| role | text | 'admin' / 'editor' / 'viewer' |
| invited_by | uuid (FK → auth.users) | Who invited |
| created_at | timestamptz | Auto |

#### `catalog_shares`
Direct catalog-level sharing (beyond client folder membership).

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| catalog_id | uuid (FK) | Shared catalog |
| user_id | uuid (FK) | Share target |
| role | text | 'viewer' (default) |
| created_at | timestamptz | Auto |

### Transcript Tables

#### `meeting_transcripts`
Uploaded meeting transcripts and their processing state.

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK → auth.users) | Owner |
| catalog_id | uuid (FK → capability_catalogs) | Target diagram (for edit mode) |
| mode | text | 'new_diagram' / 'edit_diagram' |
| title | text | Meeting title |
| meeting_date | date | Meeting date |
| raw_text | text | Original uploaded text |
| cleaned_text | text | After cleaning pass |
| context_prompt | text | User-provided context for AI |
| template_id | uuid (FK → capability_catalogs) | Template to base new diagram on |
| summary | text | AI-generated meeting summary |
| status | text | Processing state machine (see below) |
| progress | integer (0-100) | Progress percentage |
| current_step | text | Human-readable step label |
| error_message | text | Failure details |
| created_at | timestamptz | Auto |
| completed_at | timestamptz | When processing finished |

**Status State Machine:**
```
uploaded → parsing → cleaning → filtering → extracting → resolving → ready_for_review → applying → completed
                                                                                       ↘ failed
```

#### `transcript_proposals`
AI-extracted proposals from a transcript that users can accept/decline.

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| transcript_id | uuid (FK → meeting_transcripts) | Parent transcript |
| kind | text | 'node' / 'command' / 'todo' |
| payload | jsonb | Command/node/todo data |
| confidence | numeric (0-1) | AI confidence score |
| source_quote | text | Verbatim transcript excerpt |
| selected | boolean | User selection state |
| status | text | 'pending'/'accepted'/'declined'/'applied'/'failed' |
| apply_error | text | Failure reason |
| sort_order | integer | Display ordering |
| created_at | timestamptz | Auto |

---

## 5. Authentication & Authorization

### Authentication Flow

1. **Supabase Auth** handles user registration, login, and session management
2. **Next.js Edge Middleware** (`src/middleware.ts`) intercepts every non-public route
3. Middleware creates a `@supabase/ssr` server client with cookie access
4. Calls `supabase.auth.getUser()` to verify/refresh the session
5. Unauthenticated requests are redirected to `/login`

### Public Routes (No Auth Required)
- `/login`
- `/api/auth`
- `/auth/signin`
- `/` (landing page)
- `/_next/*` (static assets)
- `/assets/*`

### Server-Side Auth Helper

```typescript
// src/lib/auth/getUser.ts
export async function getUser(): Promise<User | null>
```
- Uses `@supabase/ssr` + `cookies()` from Next.js headers
- Returns the authenticated `User` object or `null`
- Used in all protected API Route Handlers

### Role-Based Access Control (RBAC)

Three roles within client folders:
| Role | Permissions |
|---|---|
| **admin** | Full access: create, edit, delete diagrams; manage members |
| **editor** | Edit diagrams, cannot manage members |
| **viewer** | Read-only access; cannot save changes |

**Enforcement Points:**
- `POST /api/catalogs/save` — checks `getUserClientRole()` and rejects viewers
- `GET /api/catalogs/[id]` — returns `userRole` field so frontend renders read-only mode
- Personal diagrams (no `client_id`) default to `admin` for the owner

### Supabase Service Role

Two Supabase clients:
- **Anon client** (client-side): Subject to Row Level Security (RLS)
- **Admin client** (server-side): Uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS for internal operations

---

## 6. API Routes Reference

### Transform (AI Core)

| Method | Path | Description |
|---|---|---|
| POST | `/api/transform` | Main AI endpoint — sends prompt + diagram state to OpenAI |

**Request Body (`TransformRequest`):**
```typescript
{
  prompt: string;                    // User's natural language instruction
  capabilities: Capability[];        // Current diagram nodes
  nodeStyles?: Record<string, NodeStylePatch>;  // Visual overrides
  history?: ChatHistoryMessage[];    // Conversation context (last 20 turns)
  mode?: "command" | "suggest" | "chat";  // AI response mode
  legend?: LegendConfig;            // Current color legend
}
```

**Response (mode=command):**
```typescript
{ commands: DiagramCommand[], summary: string }
```

**Response (mode=suggest):**
```typescript
{ proposals: Proposal[], summary: string }
```

**Response (mode=chat):**
```typescript
{ reply: string }
```

### Chat History

| Method | Path | Description |
|---|---|---|
| GET | `/api/chat?catalogId=xxx` | Load chat messages + commits + sessions |
| POST | `/api/chat` | Append new messages |
| PUT | `/api/chat` | Append commit or archive session |
| DELETE | `/api/chat?catalogId=xxx` | Clear chat history |

### Catalogs

| Method | Path | Description |
|---|---|---|
| GET | `/api/catalogs/[id]` | Load catalog + capabilities + user role |
| POST | `/api/catalogs/save` | Create or update catalog (full state save) |
| GET | `/api/catalogs/versions?catalogId=xxx` | List version history |
| POST | `/api/catalogs/restore` | Restore a visual_maps snapshot |
| GET | `/api/catalogs/templates` | List built-in system templates |
| POST | `/api/catalogs/templates` | Promote catalog to template |

### Capabilities

| Method | Path | Description |
|---|---|---|
| GET | `/api/capabilities?catalogId=xxx` | Fetch all capabilities for a catalog |

### Transcripts

| Method | Path | Description |
|---|---|---|
| GET | `/api/transcripts?limit=&offset=&catalogId=` | List user's transcripts |
| POST | `/api/transcripts` | Upload transcript (JSON or multipart/form-data) |
| GET | `/api/transcripts/[id]` | Get transcript + proposals |
| GET | `/api/transcripts/[id]/stream` | SSE stream for pipeline processing |
| PATCH | `/api/transcripts/[id]/proposals` | Accept/decline proposals |
| POST | `/api/transcripts/[id]/apply` | Apply accepted proposals to diagram |

### Clients

| Method | Path | Description |
|---|---|---|
| GET | `/api/clients` | List user's client folders |
| POST | `/api/clients` | Create new client folder |

### Works

| Method | Path | Description |
|---|---|---|
| GET | `/api/my-works` | User's catalogs grouped by client |

### Usage Stats

| Method | Path | Description |
|---|---|---|
| GET | `/api/usage-stats` | AI usage analytics (tokens, cost, by mode/day) |

---

## 7. AI/LLM Integration

### Model Configuration

| Setting | Value |
|---|---|
| Provider | OpenAI |
| Model | `gpt-4.1-mini` |
| Max Tokens | 8,192 |
| Response Format | JSON Object (command/suggest modes) or plain text (chat mode) |
| Pricing | $0.40/1M input tokens, $1.60/1M output tokens |

### Rate Limiting & Retry Strategy

```
Exponential Backoff: up to 3 retries on HTTP 429
  Attempt 1: wait 5 seconds
  Attempt 2: wait 10 seconds
  Attempt 3: wait 20 seconds
```

### Token Optimization — Capability Trimming Algorithm

The `trimCapabilities()` function reduces the capabilities sent to the AI to minimize token usage:

**Strategy (priority order):**

1. **Level-mention detection**: If prompt mentions "L0", "L1", etc., include ALL nodes up to that level
2. **Hierarchical number resolution**: If prompt contains numbers like "1.6.1.1", resolve them to specific nodes, include their ancestors + children
3. **Keyword matching (default path)**:
   - Always include all L0 + L1 nodes (structural overview)
   - L2: only nodes whose name/description matches keywords from the user's request
   - L3: only children of matched L2 nodes
   - Fallback: if no L2 matched, include all L2 but no L3
4. **Canvas-selected node override**: The currently selected node in the canvas is always included regardless of keyword matching

**Keyword Extraction:**
- Strips any `[Context:...]` prefix injected by the sidebar
- Splits on whitespace, filters words < 4 characters
- Case-insensitive substring matching against node name/description

### Prompt Modes

| Mode | Trigger Detection | AI Output |
|---|---|---|
| **command** | Default (direct action verbs: rename, delete, add, move, set) | JSON: `{ commands: [...], summary }` |
| **suggest** | Suggestion verbs (suggest, recommend, review, audit, flag) | JSON: `{ proposals: [...], summary }` |
| **chat** | Info verbs (list, show, what are, how many, count, tell me) | Plain text |

### Auto-Detection Logic

```typescript
function isSuggestionPrompt(text: string): boolean {
  // Has suggestion word AND NOT direct action word
  return /suggest|recommend|review|audit|check|analyze/.test(lower)
    && !/rename|delete|add|create|move|set the/.test(lower);
}

function isInfoPrompt(text: string): boolean {
  // Has info word AND NOT action/suggestion word
  return /list|show|what are|how many|count|tell me/.test(lower)
    && !/rename|delete|add|suggest|recommend/.test(lower);
}
```

### Usage Logging

Every AI call logs to `ai_usage_log`:
- Timestamp, model, mode
- prompt_tokens, completion_tokens, total_tokens
- cost_usd (computed from pricing model)

### JSON Salvage Algorithm

If the AI response is truncated (JSON parse fails):
1. Extract all complete `{...}` objects via regex
2. Parse each individually
3. Keep only objects with valid `type` and `nodeId` fields
4. Return salvaged commands with note: "(response was truncated — partial results applied)"

---

## 8. Command System

### Command Types (DiagramCommand Union)

| Type | Description | Key Fields |
|---|---|---|
| `SET_STYLE` | Change background/border colour | nodeId, fill?, border? |
| `SET_TEXT_COLOR` | Change text/label colour | nodeId, color |
| `RESET_STYLE` | Remove colour overrides | nodeId, fill?, border?, textColor? |
| `SET_NOTE` | Add/replace text note | nodeId, note |
| `SET_DESCRIPTION` | Update description | nodeId, description |
| `RENAME_NODE` | Rename capability | nodeId, newName |
| `REPARENT_NODE` | Move under different parent | nodeId, newParentId |
| `DELETE_NODE` | Delete node + descendants | nodeId, reparentChildren? |
| `ADD_NODE` | Create new capability | tempId, parentId, level, name, description?, insertAfterId? |
| `SET_LEGEND` | Add/update legend category | slot, entryId, label, color |
| `REMOVE_LEGEND` | Remove legend category | slot, entryId |

### Command Executor (`src/lib/commands/executor.ts`)

The executor applies commands to the in-memory capability tree and returns:

```typescript
interface ExecutionResult {
  capabilities: Capability[];              // Updated tree
  nodePatches: Record<string, NodeStylePatch>; // Visual changes for ReactFlow
  messages: string[];                      // Success messages
  errors: string[];                        // Validation failures
}
```

**Execution Rules:**
- **Structural commands** (RENAME, REPARENT, DELETE, ADD) mutate the `capabilities` array
- **Visual commands** (SET_STYLE, SET_NOTE, etc.) populate `nodePatches`
- **Level hierarchy enforcement**: REPARENT_NODE validates that `newParent.level === node.level - 1`
- **Cascade delete**: DELETE_NODE traverses the subtree via BFS
- **Reparent children option**: DELETE_NODE with `reparentChildren: true` lifts children to grandparent
- **Sort order computation**: ADD_NODE calculates position relative to insertAfterId or appends to end

### Node Numbering Algorithm

```typescript
function getCapabilityNumber(capId: string, caps: Capability[]): string
```

Computes hierarchical numbers (e.g. "1.7.5.1") by:
1. Walking up the tree from the target node to root
2. At each level, finding the node's 1-based position among sorted siblings
3. Reversing and joining with dots

### Prompt Construction (`promptBuilder.ts`)

Three builder functions produce system prompts:

1. **`buildCommandPrompt()`** — Full instruction set with all 11 command types, legend rules, palette
2. **`buildSuggestionPrompt()`** — Returns proposals instead of direct commands
3. **`buildChatPrompt()`** — Plain text answers, no commands

Each prompt includes:
- Command type specifications with JSON schemas
- Current diagram as indented tree (rendered by `renderTree()`)
- Node styles/notes inline
- Legend state and recommended unused colours
- Strict rules for level hierarchy and ID usage

### Tree Rendering for AI Context

```
L0 | 1 | Strategic Management | id:abc-123 [fill:#ff0000 border:default note:"..."]
  L1 | 1.1 | Strategy Development | id:def-456 desc:"Long-term planning"
    L2 | 1.1.1 | Planning | id:ghi-789
      L3 | 1.1.1.1 | Annual Planning | id:jkl-012
```

---

## 9. Transcript Processing Pipeline

### Overview

The transcript pipeline converts meeting recordings/notes into structured diagram changes through a multi-stage AI processing pipeline with SSE progress streaming.

### Pipeline Stages

```
Upload → Clean (15%) → Pass 1: Filter (30%) → Pass 2: Extract (55%) → Pass 3: TODOs (80%) → Resolve (95%) → Persist (100%)
```

### Stage 1: Cleaning (`clean.ts`)

**Algorithm:** Rule-based text normalization (no AI)

1. Remove standalone timestamp lines (`12:34` or `12:34:56.789`)
2. Remove bracketed stage markers (`[Recording started]`)
3. Strip inline timestamps (`(12:34)`)
4. Remove speaker prefixes (`John Smith:` or `Speaker 1:`)
5. Remove filler words (`um`, `uh`, `you know`, `like`, `sort of`, `basically`, etc.)
6. Collapse whitespace
7. Drop lines with fewer than 3 words
8. Deduplicate near-identical lines (normalized comparison)

**Output:** Cleaned text + source map (cleaned line → original line index)

### Stage 2: Pass 1 — Relevance Filter (`pass1-filter.ts`)

**AI Call:** `gpt-4.1-mini`, temperature 0.1, JSON response

**Purpose:** Remove small-talk, scheduling admin, off-topic tangents

**Prompt instructs AI to keep:** Business capabilities, processes, tools, systems, roles, priorities, decisions, action items

**Output:** Filtered transcript text (keptText)

**Retry:** One retry with stricter instruction on failure

### Stage 3: Pass 2 — Structural Extraction (`pass2-extract.ts`)

Two sub-modes based on transcript mode:

#### New Diagram Mode (`extractNew`)
- **AI Call:** `gpt-4.1-mini`, temperature 0.2, JSON response
- **Output:** `{ nodes: NodeProposalPayload[] }`
- Each node has: `tempId`, `parentTempId`, `level` (0-3), `name`, `description`, `confidence` (0-1), `sourceQuote`

#### Edit Diagram Mode (`extractEdit`)
- **AI Call:** `gpt-4.1-mini`, temperature 0.2, JSON response
- **Input includes:** Existing capability tree as YAML, current legend, user context prompt
- **Output:** `{ commands: CommandProposalPayload[] }`
- Each command includes standard fields plus: `confidence`, `sourceQuote`, `rationale`
- Uses same 11 command types as the live transform system

#### Template Mode
When `mode = "new_diagram"` but a `template_id` is set:
- Loads template capabilities
- Uses `extractEdit` mode against the template (generates commands rather than raw nodes)

### Stage 4: Pass 3 — TODOs & Summary (`pass3-todos.ts`)

**AI Call:** `gpt-4.1-mini`, temperature 0.2, JSON response

**Output:**
```typescript
{
  summary: string;    // 3-5 sentence meeting recap
  todos: [{
    text: string;           // Action item
    targetName: string;     // Related capability name (fuzzy)
    priority: "low" | "medium" | "high";
    owner: string | null;   // Person responsible
    sourceQuote: string;    // Verbatim transcript excerpt
  }]
}
```

### Stage 5: Name Resolution (`resolve.ts`)

**Algorithm:** Fuzzy string matching using **Levenshtein distance**

```typescript
function resolveCapabilityName(proposed: string, existing: Capability[]): ResolveResult | null
```

1. For each TODO's `targetName`, compare against all existing capability names
2. Normalize both strings: lowercase, strip non-alphanumeric, collapse whitespace
3. Compute similarity: `1 - (levenshtein_distance / max_length)`
4. Accept matches with confidence ≥ 0.75
5. Return the best match (highest score)

### Stage 6: Proposal Persistence

All proposals are stored in `transcript_proposals` with:
- **Nodes** (new_diagram): confidence ≥ 0.7 auto-selected
- **Commands** (edit_diagram): confidence ≥ 0.7 auto-selected
- **TODOs**: always auto-selected (confidence 0.8)

### Application Phase

#### Apply New (`applyNew.ts`)
1. Fetch accepted node proposals
2. Create a new `capability_catalogs` entry
3. Sort proposals by level (L0 first for parent resolution)
4. Generate real UUIDs, map `tempId → realId`
5. Insert all capabilities with resolved `parent_id` references
6. Process TODO proposals (attach notes to matched nodes)

#### Apply Edit (`applyEdit.ts`)
1. Load current diagram state (capabilities + nodeStyles)
2. Fetch accepted command proposals
3. Execute commands via `executeCommands()` (same executor as live transform)
4. Persist structural changes (new nodes, renames, reparents) to DB
5. Persist visual changes (nodeStyles) to `capability_catalogs.node_styles`
6. Process TODO proposals

### SSE Streaming

The `/api/transcripts/[id]/stream` endpoint uses **Server-Sent Events**:
- Returns a `ReadableStream` with `text/event-stream` content type
- Emits progress events: `{ progress: number, step: string }`
- Final event: `{ done: true }` or `{ error: string }`
- Client-side polls progress via EventSource API

---

## 10. Canvas & Layout Engine

### Layout Algorithm (`layoutEngine.ts`)

Implements a **LeanIX-style nested container layout**:

```
┌──────── L0: Strategic Management ─────────────────────┐
│ ┌─ L1 ──────┐ ┌─ L1 ──────┐ ┌─ L1 ──────────┐      │
│ │ Strategy   │ │ Org Dev   │ │ Governance     │      │
│ │  L2: Plan  │ │  L2: HR   │ │  L2: Comply    │      │
│ │   · Item1  │ │   · Item1 │ │   · Item1      │      │
│ │   · Item2  │ │   · Item2 │ │   · Item2      │      │
│ └────────────┘ └───────────┘ └────────────────┘      │
└───────────────────────────────────────────────────────┘
```

**Layout Constants:**
| Constant | Value | Purpose |
|---|---|---|
| L1_COL_W | 280px | Width of each L1 column |
| L1_COL_GAP | 16px | Gap between L1 columns |
| L0_BAND_H | 50px | L0 horizontal header height |
| L0_GROUP_GAP | 32px | Gap between L0 groups |
| L1_HDR_H | 48px | L1 colored header height |
| L2_HDR_BASE | 36px | L2 header base height |
| ROW_H | 44px | Height per L3 row |
| ROW_GAP | 3px | Gap between rows |

**Layout Process:**
1. Build tree from flat capabilities array
2. Assign hierarchical numbers to each node
3. For each L0: lay out L1 columns side-by-side horizontally
4. For each L1: stack L2 containers vertically
5. For each L2: stack L3 items vertically
6. Measure heights bottom-up (L3 → L2 → L1 → L0)
7. L0 band height = max(L1 heights) in that group
8. Generate ReactFlow `Node[]` with computed positions and dimensions

**Height Estimation:**
```typescript
function measureL2Height(l2: TreeNode): number {
  return estimateL2HdrH(name, number) + padding + (l3Children.length * (ROW_H + ROW_GAP))
}

function measureL1Height(l1: TreeNode): number {
  return L1_HDR_H + padding + sum(l2Heights) + gaps
}
```

**L2 Header Height (Multi-line):**
```typescript
function estimateL2HdrH(l2Name: string, l2Number: string): number {
  const charsPerLine = Math.floor((L1_COL_W - padding) / 7); // ~7px per char at 12px font
  const lines = Math.ceil(text.length / charsPerLine);
  return L2_HDR_BASE + Math.max(0, lines - 1) * L2_HDR_LINE;
}
```

### Color Scheme

L0 nodes cycle through a 10-colour palette:
```
Red (#c0392b), Orange (#e67e22), Purple (#8e44ad), Green (#27ae60),
Blue (#2980b9), Teal (#16a085), Dark Orange (#d35400), Navy (#2c3e50),
Grey (#7f8c8d), Yellow (#f39c12)
```

### Drag & Drop (`dragDropHandler.ts`)

**Algorithm:**

1. **Validation**: Check for circular references (node can't be dropped under its own descendant)
   - BFS to collect full subtree of dragged node
   - If new parent is in subtree → reject
2. **Sort Order Calculation**:
   - If `insertAfterNodeId` specified: use midpoint between that node and next sibling
   - If null: prepend (min sort_order - 1)
   - If no siblings: default to 0
3. **Reparenting**: Update `parent_id` of the dragged node

### ReactFlow Integration

- Custom node types: `CapabilityNode`, `DropContainerNode`
- Nodes are generated by `buildCanvasNodes()` from the layout engine
- Visual overrides (fill, border, textColor, note) are stored in `node.data`
- The canvas supports pan, zoom, selection, and drag-drop reorganization

---

## 11. Data Import (Excel Parser)

### Supported Formats
- `.xlsx` (Excel)
- `.csv`
- Any format supported by the `xlsx` library

### Expected Sheet Structure

Sheet name: "Capability Catalog" (or first sheet as fallback)

| L0 Capability Name | L1 Capability Name | L2 Capability Name | L3 Capability Name | Capability Description |
|---|---|---|---|---|
| Finance | Accounting | ... | ... | ... |

### Parsing Algorithm (`excelParser.ts`)

1. Read workbook from ArrayBuffer
2. Find sheet by name (case-insensitive match on "capability catalog") or use first sheet
3. Extract header row → find column indices via regex (`/l0/i`, `/l1/i`, `/l2/i`, `/l3/i`, `/desc/i`)
4. Validate that L0 column exists (throw if not)
5. Iterate data rows:
   - Extract text from each L-level column
   - Skip completely empty rows
   - Build `ParsedCapabilityRow[]` array

### Row-to-Capability Conversion (`rowsToCapabilities.ts`)

Converts flat rows into a hierarchical `Capability[]` tree:

1. Track "current" name at each level (L0-L3)
2. For each row, process each L-level that has a non-empty value:
   - Update current name for that level, clear deeper levels
   - Build full path key: `"level:ancestor1/ancestor2/name"`
   - Dedup: skip if path key already seen
   - Resolve parent via path key of level-1
   - Generate temporary client-side UUID
   - Description attaches only to the deepest populated level in the row

### Content-Based Deduplication

On upload, `findDuplicateCatalog()` checks if an identical catalog already exists:
1. Count rows in parsed data
2. For each active catalog, check if capability count matches
3. If count matches, compare sorted L0 names
4. Return existing catalog ID if duplicate found

---

## 12. State Management

### Zustand Store (`catalogStore.ts`)

**Persistence:** Uses `zustand/persist` middleware for localStorage persistence across page refreshes.

**State Shape:**
```typescript
interface CatalogState {
  catalogId: string | null;     // null = never saved to DB
  catalogName: string;
  industry: string | null;
  capabilities: Capability[];
  isDirty: boolean;
  nodeStyles: Record<string, NodeStylePatch>;  // Per-node visual overrides
  legend: LegendConfig;        // { fill: [], border: [], textColor: [] }
}
```

**Key Actions:**
| Action | Description |
|---|---|
| `setCatalog()` | Load from fresh upload (no DB id yet) |
| `loadFromDB()` | Load existing catalog from database |
| `markSaved(catalogId)` | After successful save — stores real ID, clears dirty |
| `markDirty()` | After any local edit |
| `setCapabilities()` | Sync from canvas (post-command execution) |
| `renameCapability()` | In-place rename |
| `setNodeStyles()` | Bulk replace visual overrides |
| `patchNodeStyle()` | Single-node style update |
| `setLegend()` | Replace legend config |
| `clear()` | Full reset |

### Legend System

```typescript
interface LegendConfig {
  fill: LegendEntry[];      // Background colour categories
  border: LegendEntry[];    // Border colour categories
  textColor: LegendEntry[]; // Text colour categories
}

interface LegendEntry {
  id: string;       // Stable slug (e.g. "already-available")
  label: string;    // Human display label
  color: string;    // Hex colour
}
```

The AI auto-creates legend entries when it applies styles with semantic meaning. A 16-colour palette is provided to ensure distinct categories.

---

## 13. Export Capabilities

### Supported Export Formats (via client-side libraries)

| Format | Library | Status |
|---|---|---|
| PNG/JPEG | html-to-image | Active |
| PDF | jspdf | Active |
| PowerPoint (.pptx) | pptxgenjs | Active |
| Excel (.xlsx) | xlsx | Active (scripts) |

### Export Generation
- Canvas is rendered to a DOM element
- `html-to-image` captures the canvas as a data URL
- PDF/PPTX libraries wrap the image with metadata
- `file-saver` triggers the browser download

---

## 14. Client/Multi-Tenancy System

### Hierarchy

```
Client Folder (Organization)
├── Members (admin/editor/viewer)
├── Catalog 1 (Diagram)
│   ├── Capabilities (tree)
│   ├── Visual Maps (versions)
│   └── Chat History
├── Catalog 2
└── ...
```

### Access Control Flow

1. User authenticates via Supabase
2. `GET /api/clients` returns folders user is a member of
3. Each folder shows catalogs where `client_id = folder.id`
4. Role is checked on save operations:
   - `getUserClientRole(clientId, userId)` → queries `client_members`
   - Viewers get read-only mode (frontend disables editing)
   - Editors can modify but not manage members
   - Admins have full control

### Personal Diagrams
- Catalogs with `client_id = null` and `user_id = currentUser`
- Owner automatically gets admin-level access
- Grouped under "My Diagrams" in the works page

---

## 15. Version Control & Snapshots

### Version Save Flow

1. On save, current state is written to `visual_maps`:
   ```json
   {
     "capabilities": [...all capability rows...],
     "nodeStyles": {...all visual overrides...}
   }
   ```
2. `version_number` increments
3. Previous versions remain stored

### Version Restore Flow (`POST /api/catalogs/restore`)

1. Fetch target `visual_maps` row
2. Delete all current capabilities for the catalog
3. Re-insert from snapshot level-by-level (L0→L3) for parent FK resolution
4. Remap snapshot IDs to new DB UUIDs
5. Remap nodeStyles keys to match new IDs
6. Set restored version as `is_active`, deactivate others
7. Return fresh capabilities + nodeStyles for client reload

---

## 16. Deployment & Environment

### Required Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, bypasses RLS) |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4.1-mini |

### Build & Run Commands

```bash
npm run dev      # Start development server (Next.js)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

### TypeScript Configuration

- Target: ES2017
- Module: ESNext (bundler resolution)
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`
- Incremental compilation enabled

### Platform Notes

- Windows: Webpack filesystem cache disabled to avoid ENOENT rename errors
- Runtime: Node.js (all API routes explicitly set `runtime = "nodejs"`)
- Deployment target: Render (referenced in error messages)

---

## Appendix: Algorithm Summary

| Algorithm | Location | Description |
|---|---|---|
| Capability Trimming | `api/transform/route.ts` | Reduces token usage by filtering capabilities sent to AI |
| Hierarchical Numbering | `commands/promptBuilder.ts` | Computes "1.7.5.1" numbers by walking parent chain |
| Level-by-level Insert | `db/postgres/capabilities.ts` | Inserts capabilities L0→L3 for parent FK resolution |
| Content Deduplication | `db/postgres/capabilities.ts` | Detects duplicate uploads via row count + L0 name comparison |
| Levenshtein Distance | `transcript/resolve.ts` | Fuzzy name matching for capability resolution (threshold 0.75) |
| Transcript Cleaning | `transcript/clean.ts` | Rule-based noise removal (timestamps, fillers, dedup) |
| Exponential Backoff | `api/transform/route.ts` | 429 retry: 5s → 10s → 20s delays |
| JSON Salvage | `api/transform/route.ts` | Extracts valid commands from truncated AI responses |
| Layout Measurement | `canvas/layoutEngine.ts` | Bottom-up height calculation for nested containers |
| Drag-Drop Validation | `canvas/dragDropHandler.ts` | BFS subtree check to prevent circular references |
| Sort Order Midpoint | `canvas/dragDropHandler.ts` | Inserts between siblings without renumbering all |
| Mode Auto-Detection | `canvas/AIMapEditor.tsx` | Regex-based classification of user intent |
| Version Restore with Remap | `api/catalogs/restore/route.ts` | Snapshot restoration with full ID remapping |

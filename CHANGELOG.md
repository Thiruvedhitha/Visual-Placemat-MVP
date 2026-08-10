# Changelog

## [0.5.0] — 2026-08-04

### Transcript Feature Enhancements

#### Summary
Five enhancements added on top of the working transcript → diagram pipeline.

#### DB Migration required
Run `scripts/migrations/2026-08-04_transcript_enhancements.sql` in Supabase SQL Editor (already done).
Adds: `meeting_transcripts.context_prompt`, `meeting_transcripts.template_id`, `capability_catalogs.notes`.

#### Files Changed

| File | Change |
|------|--------|
| `src/components/transcript/TranscriptReviewModal.tsx` | Portal fix (`createPortal` to `document.body`); dynamic tab selection |
| `src/components/transcript/TranscriptUpload.tsx` | Context prompt textarea; template picker dropdown (new_diagram only) |
| `src/types/transcript.ts` | Added `context_prompt: string \| null` to `MeetingTranscript` |
| `src/app/api/transcripts/route.ts` | Reads and stores `context_prompt`, `template_id` from request |
| `src/lib/transcript/pipeline.ts` | Threads `context_prompt` to all 3 passes; loads template caps for hybrid flow |
| `src/lib/transcript/pass1-filter.ts` | Accepts optional `contextPrompt`, appended to system prompt |
| `src/lib/transcript/pass2-extract.ts` | Accepts `contextPrompt` in ctx, injected into both extractNew and extractEdit |
| `src/lib/transcript/pass3-todos.ts` | Accepts optional `contextPrompt`, injected for todo ownership/priority |
| `src/lib/transcript/applyNew.ts` | Creation stamp on every node; `applyNewFromTemplate` path (clone + commands) |
| `src/lib/transcript/applyEdit.ts` | Change-tracking stamp on added/modified nodes |
| `src/app/api/catalogs/[id]/notes/route.ts` | New — GET/PATCH endpoint for per-diagram notes |
| `src/components/canvas/CatalogNotesPanel.tsx` | New — modal panel with auto-save textarea |
| `src/app/(routes)/dashboard/page.tsx` | Notes button in toolbar; `CatalogNotesPanel` wired in |
| `src/lib/db/postgres/schema.sql` | Replaced with live snapshot including all new columns |

#### What each fix does

**Fix 1 — Portal:** Modal was clipped by `overflow-hidden` sidebars. Now uses `createPortal(…, document.body)` so it always covers the full viewport.

**Fix 2 — Context prompt:** Free-text textarea in the upload form lets users specify speaker roles, color rules, and meeting context. Injected into all three LLM passes so the AI can attribute capabilities to the right people and emit correct `SET_STYLE`/`SET_LEGEND` commands.

**Fix 3 — Template selection:** In `new_diagram` mode, a dropdown lists built-in templates. When selected, the pipeline loads the template's capability tree and runs edit-mode extraction against it — producing `command` proposals instead of `node` proposals. `applyNew` clones the template catalog then applies the accepted commands.

**Fix 4 — Change tracking:** Every node touched by a transcript apply gets a stamp in its `note` field: `"Added/Modified via transcript 'Title' on MM/DD/YYYY"`. Nodes created from scratch get `"Created via transcript …"`.

**Fix 5 — Catalog notes:** A "Notes" button appears in the dashboard toolbar (after first save). Clicking opens `CatalogNotesPanel` — a full-screen modal with a textarea that auto-saves on blur and supports manual Save. Backed by `GET/PATCH /api/catalogs/[id]/notes`.

**Fix 6 — Tab logic:** Review modal tabs are now derived from the actual proposals: shows **Commands** tab when command proposals exist (template mode), **Nodes** tab when node proposals exist, falling back to mode default.

---



### Upload Page — UX Refinements, File Preview & Format Validation

#### Files Modified

| File | Change |
|------|--------|
| `src/app/(routes)/documents/page.tsx` | Multiple UX improvements (see below) |
| `package.json` / `package-lock.json` | Added `xlsx` (SheetJS) dependency |

#### Changes

- **Step progress bar removed** — Eliminated the `1 › 2 › 3…` wizard nav bar and the "Step 2 of 6" badge; page flows directly from the site Navbar into upload content
- **SheetJS parsing** — Uploaded `.xlsx`/`.csv` is parsed entirely in the browser using `XLSX.read` + `sheet_to_json`; no server upload occurs
- **File info bar** — After selecting a file, the drop zone is replaced by a bar showing filename, file size, and detected row count with **Replace** and **Remove** buttons
- **Smart preview table** — Shows only the first occurrence of each non-leaf L-level (L0, L1, L2…) plus up to 10 leaf-level rows; table headers auto-colour by L-column depth; footer note reads _"Showing first entry per parent level"_
- **Format validation banner** — After parsing, headers are checked for at least one `L0/L1/L2…` column:
  - ✅ Green banner: _"Format matched — detected columns: L0, L1, L2, L3 + Description"_
  - ❌ Red banner: _"Format mismatch — No L-level columns found…"_
- **"Continue to Canvas →"** button is disabled until a file is loaded **and** format validation passes
- **Expected column format** — Sample table hidden once a file is loaded to reduce visual noise

---

## [0.1.1] — 2026-04-21

### Upload Excel Page — New Route & Navigation Wiring

#### What was built

A dedicated **Step 2 — Upload Excel** page at `/documents`, matching the 6-step wizard UI. Landing page entry cards now navigate to their respective routes instead of being non-interactive buttons.

---

#### Files Created / Modified

| File | Change |
|------|--------|
| `src/app/(routes)/documents/page.tsx` | **Created** — Full upload wizard page (step 2 of 6) |
| `src/components/ui/EntryCards.tsx` | **Modified** — Cards converted from `<button>` to `<Link>` with route targets |

---

#### Page: `/documents` (`src/app/(routes)/documents/page.tsx`)

- **Step progress bar** — shows all 6 steps; step 2 highlighted in blue
- **Dark navbar** — "DiagramAI" logo, "New diagram" button, "STEP 2 OF 6" label, "Cancel" link (returns to `/`)
- **Drag-and-drop file zone** — accepts `.xlsx` and `.csv`; shows success state with green check when a file is selected; "Browse files" button triggers native file picker
- **Expected column format table** — visual preview of L0 → L1 → L2 → L3 → Description columns with matching color gradient
- **Bottom step description** — explains SheetJS browser-side parsing (no server upload)
- **Pagination controls** — ← Previous (links to `/`), `2 / 6` counter, Next → (enabled only after a file is selected)

#### EntryCards Navigation (`src/components/ui/EntryCards.tsx`)

- Added `import Link from "next/link"` and `href` property to each card definition
- "Upload Excel / CSV" → `/documents`
- "Use a template" → `/transform`
- "Start with AI prompt" → `/dashboard`
- Replaced `<button>` wrapper with `<Link>` — all hover animations and styling preserved

---

## [0.1.0] — 2026-04-20

### Landing Page — Full Implementation

#### What was built

A professional, interactive landing page for **Visual Placemat** — a tool to upload capability catalogs (Excel/CSV with L0–L3 hierarchical columns) and generate visual capability maps. The page is the first screen users see and provides three entry points into the application.

---

#### Files Created / Modified

| File | Purpose |
|------|---------|
| `.gitignore` | Ignores `node_modules/`, `.next/`, env files, build artifacts |
| `package.json` | Project manifest — Next.js 14, React 18, TypeScript, Tailwind CSS |
| `tsconfig.json` | TypeScript configuration with `@/*` path alias |
| `next.config.js` | Next.js configuration |
| `tailwind.config.ts` | Tailwind theme with custom brand & navy color palettes |
| `postcss.config.js` | PostCSS pipeline for Tailwind |
| `src/app/globals.css` | Global styles — Tailwind directives, Inter font, focus-visible rings, smooth scroll |
| `src/app/layout.tsx` | Root layout — wraps all pages with `<Navbar />`, sets metadata |
| `src/app/page.tsx` | Landing page — Hero, Entry Cards, Recent Maps, How It Works, Bottom CTA, Footer |
| `src/components/layout/Navbar.tsx` | Top navigation bar with capability-map logo |
| `src/components/layout/Footer.tsx` | Page footer with links and copyright |
| `src/components/ui/EntryCards.tsx` | Three "how to start" entry-point cards |
| `src/components/ui/HowItWorks.tsx` | Four-step "How it works" section with gradient badges and connector line |
| `src/components/ui/RecentDiagrams.tsx` | Recent maps quick-access section |
| `src/types/globals.d.ts` | TypeScript declaration for `.css` module imports |
| `src/app/api/*/route.ts` | Placeholder API route handlers (auth, documents, embeddings, export, graph, transform) |

---

#### Page Flow (top → bottom)

1. **Hero** — Dark gradient background, "Capability Visual Mapping" badge, headline "Turn your data into Visual Capability Maps", "See how it works" anchor link
2. **Entry Cards** — Three interactive cards: Upload Excel/CSV, Use a template, Start with AI prompt
3. **Recent Maps** — Quick-access buttons for recently created maps with color-coded dots
4. **How It Works** — Four-step guide with gradient step badges, connector line, and hover effects
5. **Bottom CTA** — "Ready to build your first diagram?" section
6. **Footer** — Copyright, Home, My Works, Privacy, Terms links

---

#### Component Breakdown

##### 1. Navbar (`src/components/layout/Navbar.tsx`)
- Sticky dark navbar with custom **hierarchical capability map logo** (SVG showing L0 header → L1 columns → L2 nested blocks with blue-to-cyan gradient and glow effect)
- **Left side**: Visual Placemat brand + logo, "Home" (active pill), "My Works" link
- **Right side**: "Sign in" button
- Fully responsive — collapses into a hamburger menu on mobile
- Accessible: `aria-label`, `aria-expanded`, focus-visible outlines

##### 2. Entry Cards (`src/components/ui/EntryCards.tsx`)
- Three cards in a responsive grid (`1 col mobile → 3 cols desktop`)
- **Upload Excel / CSV** — dashed border, light-blue accent (primary action)
- **Use a template** — clean white card with document icon
- **Start with AI prompt** — sparkle icon, white card
- Hover effects: scale-up + lift, shadow, directional arrow reveal

##### 3. How It Works (`src/components/ui/HowItWorks.tsx`)
- Four steps: Upload or describe → AI builds the map → Edit via prompts → Export & share
- Each step has a unique gradient badge (blue, violet, emerald, amber)
- Horizontal gradient connector line on desktop
- Cards lift on hover with colored accent bar at bottom
- Section header with pill badge and subtitle

##### 4. Recent Maps (`src/components/ui/RecentDiagrams.tsx`)
- Horizontal list of recent map buttons with color-coded dots
- Shows map name + relative timestamp
- Hover: border highlight, arrow slide, shadow lift

##### 5. Footer (`src/components/layout/Footer.tsx`)
- Copyright line with current year
- Navigation links: Home, My Works, Privacy, Terms

---

#### Branding

| Item | Value |
|------|-------|
| App name | **Visual Placemat** |
| Tagline | Capability Visual Mapping |
| Hero headline | Turn your data into Visual Capability Maps |
| Logo | Custom SVG — hierarchical capability map (L0/L1/L2 blocks with gradient + glow) |

---

#### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Tailwind CSS | Utility-first, zero-runtime, consistent with architecture doc |
| Custom color palette (`brand-*`, `navy-*`) | Matches the dark navbar + blue accent from the wireframe |
| Inter font | Clean professional typeface, industry standard for SaaS |
| CSS transitions over JS animation libs | Lightweight, no extra dependencies for simple hover effects |
| `"use client"` on interactive components | Required by Next.js App Router for `useState` / event handlers |
| SVG inline icons | No external icon library dependency, tree-shakeable |
| Anchor link for "See how it works" | Smooth scrolls to `#how-it-works` section with `scroll-mt-20` offset for sticky navbar |
| `.gitkeep` placeholder files retained | Keep folder structure visible in git for team onboarding |

---

#### How to Run

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

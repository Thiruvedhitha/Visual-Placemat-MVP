# Visual Placemat — Demo Script
### Week 4 Sprint Review — Deliverables Walkthrough
**Date:** May 26, 2026
**Sprint plan reference:** Development Phase — Week 4 target: Data Export & Templates | PNG, PPTX, JSON export + Version History

---

## Sprint Plan Context

| Week | Deliverable | Milestone |
|------|-------------|-----------|
| Week 1 | Basic UI | UI + Excel Upload + Export |
| Week 2 | React Flow Visual Editor + Database Setup | Capability map on canvas, Database Configuration |
| **Week 3** | Claude API Integration | Prompt → preview → canvas update live |
| **Week 4 ← Today** | Data Export & Templates | PNG, PPTX, JSON export + Version History |
| Week 5 | Optimisation & Bug Fixes, Testing | Bug fixing and Deploy |

---

## Opening Statement

> "Today's demo is focused on Week 4 deliverables — export and version history — which are now complete. I'll also quickly recap what changed since the Week 3 demo based on the feedback we received, then go deep on the new Week 4 work."

---

## PART A — Week 3 Recap & Feedback Changes

> "In the Week 3 demo, the team gave feedback on two things that needed to change. Both have been addressed."

---

## A1. Multi-Select Nodes *(feedback from Week 3 demo)*

**Context:** Previously, node selection only worked one at a time. The Week 3 demo raised the need to act on multiple nodes simultaneously.

**What to show:**
- Click a node to select it — single selection with highlighted border
- Hold **Ctrl** and click additional nodes across any level — each highlights
- With multiple nodes selected, open the **Properties** panel → the panel switches to multi-select mode
- Show the **Background** and **Border** colour pickers in the panel
- Apply a background colour — all selected nodes update at once

**Script:**
> "Based on Week 3 feedback, we've added multi-select. Users hold Ctrl and click to build a selection across any level of the hierarchy. The Properties panel adapts — instead of showing a single node's properties, it shows the shared colour controls for the entire selection. One click colours everything at once."

> "This is useful for workshops where you want to mark a whole set of capabilities — say all 'in progress' items — with a single colour in one action."

---

## A2. Add Node — Standalone Functionality *(feedback from Week 3 demo)*

**Context:** The Week 3 demo raised that adding new nodes was not clearly surfaced as a standalone action separate from the AI editor.

**What to show:**
- Point to the **+ Add Node** button at the bottom of the left sidebar — clearly visible without opening any panel
- Click it — the Add Node Wizard opens as a dedicated modal
- Fill in: Node name, Level (L0 / L1 / L2 / L3), Parent (dropdown filtered by chosen level)
- Click **Add** — node appears on the canvas immediately nested under its parent
- Show it works the same whether the map was built from Excel or AI prompt

**Script:**
> "Adding a node is now a first-class action — it has its own button in the sidebar, completely independent of the AI editor. Users don't need to open the AI panel or type a prompt just to add one capability. They click Add Node, fill in three fields, and it's on the canvas."

> "This separation was important — manual editing and AI-assisted editing are now two distinct, clearly labelled entry points."

---

## PART B — Week 4 Deliverables

> "Now the main focus of today — Week 4. The milestone was PNG, PPTX, JSON export plus version history. All delivered."

---

## B1. Export — PNG, SVG, PDF, JSON, CSV

**What to show:**
- Click the **Export** button in the top-right toolbar → navigates to `/export`
- Walk through each available format:
  - **PNG** — full canvas rendered as a rasterised image, ready for slide decks and emails
  - **SVG** — scalable vector, perfect for large-format printing or embedding in tools like Figma
  - **PDF** — print-ready, paginated document
  - **JSON** — complete raw data structure (capabilities tree + node styles) for downstream integration
  - **CSV** — flat tabular export of the capability data for spreadsheet use
- Click PNG → trigger the download, show the file

**Script:**
> "Export is the last step in the user journey. Once the map is built and reviewed, users can take it out of the tool in whichever format their workflow needs."

> "PNG and SVG are for presentations — drop them straight into PowerPoint, Keynote, or Confluence. PDF is for stakeholder documents. JSON gives engineering teams the structured data to pipe into other systems. CSV brings it back to spreadsheet form for analysis."

> "Every export captures the current canvas state — custom nodes, colour overrides, the full hierarchy as it stands."

---

## B2. Version History — Save & Restore

**What to show:**
- Click **Apply** in the top toolbar — saves current state to the database
- Show the loading indicator then success confirmation
- Click the **Version History** icon (clock icon) in the toolbar — panel slides open from the right
- Show the list of saved versions: version number, name, timestamp, active badge (green "Current" label)
- Click a version name inline to rename it — e.g. type "Post-workshop review"
- Click **Restore** on a previous version — the canvas reverts immediately to that snapshot
- Show a toast confirming the restore

**Script:**
> "Version history is the persistent safety net. Every time a user clicks Apply, the full state of the diagram — the capability tree, all colour overrides, every node style — is saved to the database as a numbered, timestamped snapshot."

> "Users can rename any version to something meaningful — 'Before stakeholder review', 'Post-workshop v2' — so it's easy to navigate back to the right checkpoint."

> "Restore re-applies the exact snapshot. The canvas updates immediately, and the restored version is now marked as current."

**How it works (technical):**

Every Apply triggers `POST /api/catalogs/save` which:
1. Deletes the current live capability rows from the database
2. Re-inserts them level-by-level — L0 → L1 → L2 → L3 — so `parent_id` foreign keys resolve correctly at each step
3. Writes a new row to `visual_maps` with the full snapshot as a JSON blob in `layout_data`:
   ```json
   { "capabilities": [...], "nodeStyles": { "node-id": { "fill": "#hex", "border": "#hex" } } }
   ```
4. Auto-increments `version_number`, marks this version as `is_active`, deactivates all others

Restore triggers `POST /api/catalogs/restore` which:
1. Fetches `layout_data` from the target version row
2. Deletes current capabilities
3. Re-inserts the snapshot level-by-level, remapping old IDs → new DB UUIDs for correct parent links
4. Returns the restored `capabilities[]` and `nodeStyles` to the canvas live

---

## B3. Undo / Redo

**What to show:**
- Make a change — rename a node, apply a colour, delete something
- Click the **Undo** button (← in toolbar) — change reverts
- Click **Redo** (→) — change re-applies
- Show keyboard: **Ctrl+Z** / **Ctrl+Y** work from anywhere, even inside an input field
- Hover the button — tooltip shows step count e.g. "Undo · 3 steps"

**Script:**
> "Undo and redo wrap every action on the canvas — renames, colour changes, additions, deletions, reparenting, and AI-applied suggestions. Nothing is irreversible within the session."

> "It works via keyboard shortcuts from anywhere on the page, not just when the canvas is in focus. The tooltip tells you how many steps are banked."

**How it works (technical):**

Every mutation calls `pushUndoAndSet()` — before applying the new state, it snapshots `{ capabilities[], nodeStyles{} }` onto an in-memory undo stack (capped at 10 entries). Redo is the reverse. Rapid text/colour changes are debounced at 400–600 ms so fast edits produce one undo entry, not one per keystroke. Both stacks are also written to `localStorage` keyed by catalog ID and reloaded on mount — so stacks survive a page refresh.

| What gets undone | Included |
|---|---|
| Node rename | ✅ |
| Add / delete node | ✅ |
| Background / border colour | ✅ |
| Node drag / reparent | ✅ |
| AI-applied suggestions | ✅ |

| | Undo / Redo | Version History |
|---|---|---|
| Storage | Memory + localStorage | Supabase database |
| Triggered by | Every edit automatically | Clicking Apply manually |
| Steps | Up to 10 | Unlimited snapshots |
| Survives page reload | Yes (localStorage) | Yes (database) |
| Granularity | Every individual action | Named checkpoints |

---

## PART C — AI Map Editor (Week 3 Delivery, shown for completeness)

**What to show:**
- Click **AI map editor** in the top toolbar — panel opens on the right
- Type a prompt: *"Add a new L1 called 'Data & Analytics' under the main L0"*
- Show the AI processing indicator
- Show the **Suggestions panel** — a list of proposed changes (e.g. Rename, Add Node, Recolour)
- Click **Accept** on one suggestion — that change applies to the canvas immediately
- Click **Decline** on another — it is skipped, the rest remain active and actionable

**Script:**
> "This was the Week 3 milestone — Claude API integration. The AI map editor takes a plain-language prompt, generates a set of structured commands, and presents each one as a suggestion the user reviews individually."

> "Accept applies the change directly to the canvas and records it in the undo stack. Decline skips it. Users are always in control — they never have to accept a batch blindly."

---

## C1. Start with AI Prompt — Blank Canvas Flow

**What to show:**
- Navigate back to the home page
- Click **Start with AI prompt**
- A blank canvas loads immediately — no nodes, no pre-loaded data
- The AI map editor panel is open by default on the right
- Type a prompt: *"Create a capability map for a retail bank with L0 as the bank name, three L1 divisions, and two L2 capabilities each"*
- Accept suggestions — nodes populate the canvas from scratch

**Script:**
> "When users click 'Start with AI prompt' from the home page, they land on a completely blank canvas with the AI panel already open. No upload needed. They describe their domain, review the suggestions, and accept them to build the map from nothing."

---

## Closing Statement — Week 4 Summary

> "To summarise what Week 4 delivered against the sprint plan milestone of 'PNG, PPTX, JSON export + version history':"

- ✅ **PNG export** — full canvas rasterised and downloaded
- ✅ **SVG export** — scalable vector output
- ✅ **PDF export** — print-ready document
- ✅ **JSON export** — full data structure for integration
- ✅ **CSV export** — tabular capability data
- ✅ **Version history** — Apply saves named snapshots to Supabase, Restore re-applies any previous version live
- ✅ **Undo / Redo** — 10-step in-memory stack with localStorage persistence
- ✅ **Multi-select** — Ctrl+click selection with bulk colour changes *(Week 3 feedback item)*
- ✅ **Add Node as standalone action** — dedicated wizard in sidebar, separate from AI editor *(Week 3 feedback item)*

> "Week 5 focus is optimisation, bug fixing, and deploy prep. The application is functionally complete against the MVP spec."

---

*End of demo script.*

## 9. Undo / Redo

**What to show:**
- Make a change — rename a node, move it, apply a colour
- Click the **Undo** button (← arrow in toolbar) — change is reverted
- Click **Redo** (→ arrow) — change is re-applied
- Show keyboard shortcuts: **Ctrl+Z** (undo), **Ctrl+Y** (redo)
- Show the tooltip on hover — it shows how many undo steps are available (e.g. "Undo · 3 steps")

**Script:**
> "Every action on the canvas is undoable — renames, colour changes, node additions, deletions, reparenting, AI-applied changes — everything."

> "The tooltips on the buttons tell you exactly how many steps are available. Ctrl+Z and Ctrl+Y work from anywhere on the page, even while an input field is focused."

**How it works (technical):**

Every mutation on the canvas — rename, delete, drag, colour change, AI apply — calls a single central function called `pushUndoAndSet`. Before applying the new state, it snapshots the current state as `{ capabilities[], nodeStyles{} }` and pushes it onto an in-memory undo stack. The redo stack is cleared at that point.

- **Undo (Ctrl+Z):** Pops the top snapshot off the undo stack, pushes the current state onto the redo stack, and restores the snapshot.
- **Redo (Ctrl+Y / Ctrl+Shift+Z):** Reverse of the above.
- **Limit:** The stack holds up to 10 steps. Older entries drop off automatically.
- **Debouncing:** Rapid actions like typing a name or dragging a colour picker are debounced at 400–600 ms, so fast sequences only create one undo entry — not one per keystroke.
- **Persistence:** The undo and redo stacks are written to `localStorage` on every change, keyed as `vp-undo-{catalogId}`. They are reloaded on mount, so stacks survive a page refresh within the same session.

| What gets undone | Included |
|---|---|
| Node rename | ✅ |
| Add / delete node | ✅ |
| Background / border colour | ✅ |
| Node drag / reparent | ✅ |
| AI-applied suggestions | ✅ |
| Zoom / pan | ✗ (view only) |

---

## 10. Version History (Version Control)

**What to show:**
- Click **Apply** in the top toolbar — saves the current state to the database (shows a loading state, then success)
- Click the **Version History** icon (clock icon) in the toolbar — the Version History panel slides in from the right
- Show the list of saved versions with version numbers, names, and timestamps
- Show the active version highlighted in green labelled "Current"
- Click a version name inline to rename it
- Click **Restore** on a previous version — canvas reverts to that exact snapshot
- Show a toast confirming the restore

**Script:**
> "Undo/redo is great for in-session edits, but version history is the persistent safety net. Every time a user clicks Apply, the full state of the diagram is saved to the database as a named, timestamped snapshot."

> "Users can browse all past versions in the panel, rename them to meaningful labels like 'Before stakeholder review' or 'Post-workshop v2', and restore any one of them with a single click. It's a lightweight version control system — like Git checkpoints, but for capability maps."

**How it works (technical):**

Version history lives in a Supabase `visual_maps` table — completely separate from the in-memory undo stack.

**Saving a version (clicking Apply):**
1. Calls `POST /api/catalogs/save`
2. Deletes the current live `capabilities` rows for this catalog from the database
3. Re-inserts them level-by-level — L0 first, then L1, L2, L3 — so `parent_id` foreign keys resolve correctly at each step
4. Writes a new row to `visual_maps` with the full snapshot stored as a JSON blob in `layout_data`:
   ```json
   { "capabilities": [...], "nodeStyles": { "node-id": { "fill": "#hex", "border": "#hex" } } }
   ```
5. Assigns an auto-incrementing `version_number`, sets `is_active = true`, deactivates all other versions for that catalog

**Listing versions:** `GET /api/catalogs/versions?catalogId=xxx` — returns all versions newest-first with `version_number`, `name`, `is_active`, `created_at`.

**Restoring a version (clicking Restore):**
1. Calls `POST /api/catalogs/restore` with `{ catalogId, versionId }`
2. Fetches the target `visual_maps` row and reads `layout_data`
3. Deletes all current `capabilities` rows for the catalog
4. Re-inserts the snapshot capabilities level-by-level, remapping old snapshot IDs to new DB UUIDs so `parent_id` links are preserved
5. Marks that version as `is_active = true`, deactivates all others
6. Returns the restored `capabilities[]` and `nodeStyles` to the canvas — the map updates immediately

**Renaming a version:** `PATCH /api/catalogs/versions/{id}` — updates the name inline without a page reload.

| | Undo / Redo | Version History |
|---|---|---|
| Where stored | Memory + localStorage | Supabase database |
| Triggered by | Every edit automatically | Manually clicking Apply |
| Steps available | Up to 10 | Unlimited permanent snapshots |
| Survives page reload | Yes (localStorage) | Yes (database) |
| Survives clearing catalog | No | Yes |
| Granularity | Every individual action | Named checkpoints |

---

## 11. AI Map Editor

**What to show:**
- Click **AI map editor** in the top toolbar — panel opens on the right
- Type a prompt: *"Add a new L1 called 'Data & Analytics' under the main L0"*
- Show the AI processing indicator
- Show the **Suggestions panel** — a list of proposed changes (e.g. Rename, Add Node)
- Click **Accept** on a suggestion — that change is applied to the canvas immediately
- Click **Decline** on another — it is skipped, other suggestions remain active
- Show that accepted/declined suggestions are clearly marked, and remaining ones are still actionable

**Script:**
> "The AI map editor lets users modify the capability map through natural language. You describe what you want, the AI generates a set of structured commands, and you review each one as a suggestion before it's applied."

> "Each suggestion can be individually accepted or declined — you're never forced to take all changes at once. Accepted changes go straight onto the canvas and into the undo stack. Declined changes are skipped but the rest remain available."

---

## 12. Start with AI Prompt (Blank Canvas Flow)

**What to show:**
- Navigate back to the home page
- Click **Start with AI prompt**
- Show a blank canvas loads immediately — no nodes, no data
- The AI map editor panel is open by default on the right
- Type a prompt: *"Create a capability map for a retail bank with L0 as the bank name, three L1 divisions, and two L2 capabilities each"*
- Show suggestions appear and accept them — nodes populate the canvas from scratch

**Script:**
> "The second entry point skips the upload entirely. Users land on a blank canvas with the AI panel already open. They describe their organisation or domain, and the AI builds the initial map as a set of suggestions they can review and accept."

> "This is ideal for workshops or early discovery sessions where there's no spreadsheet yet — the team can sketch out a capability structure in minutes just by talking to the AI."

---

## Closing Statement

> "To summarise what we've delivered in this sprint:
> - End-to-end upload flow with client-side parsing and format validation
> - Interactive canvas with automatic hierarchy layout
> - Multi-select with bulk colour changes
> - Add and delete nodes directly on the canvas
> - Named colour legend categories for background and border
> - Export to PNG, SVG, PDF, JSON, and CSV
> - Full undo/redo with local persistence
> - Version history with point-in-time restore
> - AI map editor with per-suggestion accept/decline
> - Blank canvas AI prompt mode from the home page
>
> The application is running end-to-end. The next sprint focuses on [authentication, sharing, and collaborative editing — or whatever is next in the backlog]."

---

*End of demo script.*

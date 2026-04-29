# CapMap — Complete Product Features

> This document describes what CapMap does at every stage of growth — from the initial MVP through to the full enterprise product. Written for anyone to understand, no technical background needed.

---

## Release Roadmap

| Phase | Timeline | What Users Get |
|-------|----------|---------------|
| **MVP** | Weeks 1–8 | Upload a catalog, see it as a visual map, edit with AI, export as PNG |
| **v2** | Months 3–5 | Sign in, team sharing, smarter AI, undo across sessions |
| **v3** | Months 6–9 | Admin controls, analytics, enterprise login, approval workflows |
| **v4+** | Month 10+ | API access, mobile, integrations with other tools |

---

## 1. Getting Started

### MVP
- **No account needed** — open the app and start working immediately.
- Each user's work is private to their browser. Nobody else can see it.

### v2
- **Sign in with email and password** — access your work from any computer.
- **Sign in with Google or Microsoft** — one-click login for enterprise users.
- **Password reset** via email if you forget your credentials.

### v3
- **Enterprise login (SSO)** — your company IT team connects CapMap to your existing login system.
- **Two-factor authentication** — extra security for sensitive client work.
- **Organisation accounts** — your firm has one account, all consultants join it.
- **Roles within the firm** — Admin, Consultant, Viewer, AI Developer (see Role-Based Access doc).

---

## 2. Working with Catalogs

### MVP
- **Upload an Excel file** (.xlsx or .csv) containing your capability catalog (L0 through L3 levels).
- The system reads the spreadsheet and shows you a visual map instantly.
- **Create multiple catalogs** — each upload becomes a separate project.
- **Archive** a catalog when a project is done (you can restore it later).

### v2
- **Share a catalog** with a colleague — they can view or edit depending on the access you give them.
- **Templates** — instead of uploading from scratch, start from a pre-built industry template (e.g., "Banking Strategy Map").
- **Activity feed** — see who edited what and when on any shared catalog.

### v3
- **Client workspaces** — group multiple catalogs under one client (e.g., Standard Chartered has a Strategy map and an Operations map).
- **Invite client contacts** as read-only viewers so they can review the map.
- **Compare two catalogs side by side** — see what was added, removed, or changed between versions or between clients.

---

## 3. The Visual Map (Canvas)

### MVP
- **Interactive capability map** — your spreadsheet transformed into a colour-coded, zoomable diagram.
- **Four colour levels:** L0 (dark navy headers), L1 (blue columns), L2 (light blue), L3 (pale blue).
- **Pan and zoom** — drag to move around, scroll to zoom in and out.
- **Click any node** to see its details in a sidebar panel.
- **Toggle layers** — show or hide L0, L1, L2, L3 independently to focus on a specific level.
- **Ghost preview** — when AI suggests changes, you see them as faded "ghost" nodes before you decide to accept them.

### v2
- **Drag nodes** to reposition them anywhere on the canvas.
- **Select multiple nodes** at once (Shift+click or drag a box around them).
- **Collapse/expand** — click an L0 group to collapse or expand its children.
- **Minimap** — a small overview in the corner for large maps with 100+ nodes.
- **Focus mode** — click an L0 domain to zoom into just that section.
- **Detailed node panel** — click a node to see: full name, description, parent, children count, who last edited it, and which AI prompt created it.

### v3
- **Layout options** — choose horizontal, vertical, radial, or compact grid layouts.
- **Light and dark themes** for the canvas.
- **Custom colours** — firms can set their own brand colours per level.
- **Custom node shapes** — rectangles, rounded boxes, or hexagons.

---

## 4. Editing the Map

### MVP — Manual Editing
- **Add a node** — create a new capability under any existing parent.
- **Remove a node** — delete a capability (and optionally its children).
- **Rename a node** — change the label of any capability.
- **Drag to reposition** — move nodes to better locations on the canvas.
- All edits happen instantly — no waiting for the database.

### MVP — AI Editing
- **Type a plain English instruction** (e.g., "Add risk management capabilities under Finance").
- The AI analyses your current map and the industry context, then suggests specific changes.
- You see the proposed additions/removals/renames in a **Preview Panel** before anything happens.
- Click **Apply** to accept the changes, or **Cancel** to discard them.
- The AI uses your industry context to make relevant suggestions (banking maps get banking-specific capabilities, not healthcare ones).

### v2
- **Smarter AI** — simple edits (rename, single add) are handled by a faster model, complex edits by a more powerful one. You won't notice the difference — it just gets faster and cheaper.
- **Prompt history** — see every AI instruction you've ever given for this catalog, with the outcome.
- **Repeat a prompt** — re-run a previous instruction with one click.
- **Bookmark prompts** — save frequently used instructions as shortcuts.

### v3
- **Conversation mode** — have a back-and-forth dialogue with the AI about your map.
- **Transparency** — ask the AI "why did you add this?" and see the reasoning and sources.
- **Batch prompts** — queue up multiple instructions and run them all at once, review all changes together.
- **AI suggestions** — the system proactively suggests improvements (e.g., "Your map is missing Regulatory Compliance — it appears in 11 out of 14 banking maps we've seen").

---

## 5. Approving and Saving Changes

### MVP
- **Preview before Apply** — every change (manual or AI) is shown to you before it takes effect.
  - Green rows = additions
  - Red rows = removals
  - Amber rows = renames
- **Apply** — saves everything to the database in one go. Creates a new version of your map.
- **Cancel** — discards the proposed changes. Your map stays exactly as it was.
- **Auto-draft** — your work is automatically saved in the browser every few seconds. If you refresh the page, nothing is lost.

### v3
- **Approval workflow** — for large engagements, a senior consultant must approve changes before they become official.
- **Workflow states:** Draft → Pending Approval → Approved or Rejected.

---

## 6. Undo and Redo

### MVP
- **Undo (Ctrl+Z)** — go back to the previous state.
- **Redo (Ctrl+Y)** — re-apply what you just undid.
- Works for manual edits and AI edits.
- **Session-only** — undo history is available while the browser tab is open. Closing the tab clears it.
- Refreshing the page keeps your current map state (auto-draft), but clears the undo stack.

### v2
- **Cross-session undo** — even after closing the browser and coming back, you can undo previous changes because the full history is stored in the database.
- **Undo a specific change** — not just the most recent one. Pick any past edit from the history and reverse it.

---

## 7. Version History

### MVP
- **Version list** — sidebar shows the last 10 saved versions of your map.
- Each version shows: version number, the prompt that created it, and the timestamp.
- **Restore** any previous version with one click.

### v2
- **Compare two versions** — see exactly what was added, removed, or renamed between any two versions.
- **Export a change log** — download a PDF or PPTX showing what changed.

### v3
- **Full audit trail** — every action is logged: uploads, edits, exports, who did what and when.
- **Immutable log** — cannot be deleted, for compliance.
- **Export audit log** as CSV for reporting.

---

## 8. Exporting Your Map

### MVP
- **PNG image** — download the canvas as a picture. Runs entirely in the browser.

### v2
- **PowerPoint (PPTX)** — generates a slide deck with one slide per L0 domain.
- **SVG** — vector image that stays sharp at any size.
- **Excel** — reconstructs the original spreadsheet format from the current map.
- **CSV** — flat list of all capabilities with level and parent.
- **PDF** — styled document of the full map.
- **Custom PowerPoint template** — your firm uploads a branded template, all exports use it.

### v2 — Integrations
- **Confluence** — push the map as a structured wiki page. Updates sync automatically.
- **Miro** — push the map to a Miro board as sticky notes.

### v3
- **SharePoint / Teams** — export directly to SharePoint or post a summary to a Teams channel.
- **REST API** — developers can pull catalog data programmatically.
- **Webhooks** — trigger external notifications when a map is updated.

### v4
- **Public API** — full developer documentation for third-party integrations.
- **Marketplace** — pre-built integrations for ServiceNow, Salesforce, Jira, etc.

---

## 9. AI Knowledge Base

### MVP
- The AI uses a **knowledge base** of capability patterns to make better suggestions.
- Knowledge is filtered by **industry** — banking prompts only retrieve banking knowledge.
- Pre-loaded with industry templates (Strategy, Finance, Operations patterns per industry).

### v2
- **Knowledge grows over time** — every approved map contributes anonymised patterns back to the knowledge base.
- **Knowledge Base admin panel** — AI Developers can view, add, edit, and remove knowledge entries.
- **Structural knowledge** — the system learns which capabilities typically sit together (e.g., "Risk Management always has Credit Risk and Operational Risk as children").
- **Frequency-ranked suggestions** — "Credit Risk (appears in 14/14 banking maps)" ranks above "Market Risk (9/14 maps)".

### v3
- **Import industry frameworks** — load standard frameworks like TOGAF, BIAN (banking), HL7 (healthcare).
- **Knowledge analytics** — which topics have the best coverage, which industries need more templates.
- **RAG hit rate** — track how often the AI finds high-quality matches in the knowledge base.

---

## 10. Quality and Validation

### MVP
- **Structural validation** — the system prevents invalid map structures:
  - Every L1 must have an L0 parent, L2 must have L1, L3 must have L2.
  - No orphan nodes (every node is connected).
  - No circular references.
- If AI produces an invalid change, it **automatically retries** (up to 2 times) before showing an error.

### v2
- **Duplicate detection** — warns if a capability with the same name already exists.
- **Naming rules** — firms can enforce naming conventions (e.g., all L1 names must end in "Management").
- **Consistency check** — flags when the same concept is named slightly differently across maps.

### v3
- **Custom rules** — admins define their own validation rules (warnings or hard blocks).
- **Example:** "No L1 can have more than 8 children."
- Rules are managed through a visual editor, no coding needed.

---

## 11. Administration

### v2
- **Invite users** to your organisation.
- **Remove users** and reassign their catalogs.
- **View all catalogs** across the organisation (read-only).
- **Set available industries** — choose which industry options appear in the dropdown.

### v3
- **Full admin panel** — user management, roles, billing, system settings.
- **System prompt management** — edit the AI instructions without involving engineers.
- **Validation rule editor** — create custom rules.
- **Export watermarking** — auto-embed your firm's logo on all PNG and PPTX exports.
- **Mandatory fields** — require consultants to enter an engagement code when creating a catalog.

---

## 12. Notifications

### v2
- **In-app notifications** — alerts when someone edits a shared catalog, shares a catalog with you, or comments on a node.

### v3
- **Email notifications** — daily activity digest, approval workflow alerts, weekly knowledge base updates.

---

## 13. Comments and Collaboration

### v2
- **Comment on any node** — add a note, question, or action item to a specific capability.
- **Threaded replies** — conversations stay organized per node.
- **Presence indicator** — see when another user is editing the same catalog.
- **Node locking** — if someone is editing a node, it's locked for others until they finish.

### v3
- **Annotation mode** — place sticky-note-style comments anywhere on the canvas (not tied to a specific node).
- Useful for workshop facilitation and client presentations.
- Export the map with or without annotations.

---

## Complete Feature Timeline

| Feature | MVP | v2 | v3 | v4 |
|---------|-----|----|----|-----|
| Upload Excel & visualize | ✅ | | | |
| Manual editing | ✅ | | | |
| AI editing (Claude) | ✅ | | | |
| PNG export | ✅ | | | |
| In-session undo/redo | ✅ | | | |
| Version history (basic) | ✅ | | | |
| Auto-draft (browser) | ✅ | | | |
| Sign in (email/Google/SSO) | | ✅ | | |
| Share catalogs | | ✅ | | |
| PPTX/SVG/PDF/Excel export | | ✅ | | |
| Smarter AI (fast + powerful models) | | ✅ | | |
| Cross-session undo | | ✅ | | |
| Node comments | | ✅ | | |
| Confluence/Miro integration | | ✅ | | |
| Knowledge base admin | | ✅ | | |
| Admin panel | | | ✅ | |
| Approval workflows | | | ✅ | |
| Custom validation rules | | | ✅ | |
| Enterprise SSO (SAML) | | | ✅ | |
| Analytics dashboard | | | ✅ | |
| AI suggestions (proactive) | | | ✅ | |
| REST API | | | ✅ | |
| Public API & marketplace | | | | ✅ |
| Mobile layout | | | | ✅ |
| Third-party integrations | | | | ✅ |

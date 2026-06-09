# Visual Placemat — User Journey Guide

As a consultant, I use this application to build and communicate capability maps for my clients. I can start by uploading an Excel file of capabilities to instantly generate a structured map, pick a ready-made template, or simply describe what I need and let AI build the canvas from scratch. The walkthrough below covers the end-to-end journey I follow on every engagement.

---

## Step 1 — Sign In

> **[SCREENSHOT: Login / Sign-in screen]**

- Open the app and land on the **Sign In** page.
- Enter email and password, then click **Sign In**.
- Get redirected to the **Home / Dashboard** screen.

---

## Step 2 — Choose Your Starting Point

> **[SCREENSHOT: Home screen showing the two entry options]**

From the dashboard, there are two ways to start:

- **Upload an Excel file** of capabilities → the app auto-generates all nodes from the spreadsheet.
- **Start from a Template or AI Prompt** → pick a pre-built template or describe the map and let AI build it.

---

### Option A — Excel Import

> **[SCREENSHOT: File-upload modal / drag-and-drop zone]**

- Click **Import Excel**.
- Drag and drop (or browse to) the `.xlsx` file containing the capability list.
- The app parses every row into capability nodes and opens the canvas automatically.

---

### Option B — Template or AI Prompt

> **[SCREENSHOT: Template picker modal with AI prompt field visible]**

- Click **Start from Template**.
- Pick a template from the gallery that matches the client's industry, **or**
- Type a plain-English description in the AI prompt field (e.g., *"Create a 3-tier capability map for a retail bank"*) and click **Generate**.
- The canvas opens pre-populated and ready to edit.

---

## Step 3 — The Canvas Overview

> **[SCREENSHOT: Full canvas — highlight top-left panel, centre canvas, and zoom controls]**

- **Top-left panel** — Recent Diagrams for quick access to previously saved placemats.
- **Centre canvas** — the active template or imported capability map being worked on.
- **Zoom controls** — bottom-right toolbar to zoom in, zoom out, or fit to screen.
- **Left sidebar** — browse client folders.
- **Right sidebar** — edit node properties.

---

## Step 4 — Editing a Single Node

> **[SCREENSHOT: Single node selected, right-sidebar Properties panel open — highlight the four fields]**

- Click any node on the canvas to select it — the **Properties Panel** opens on the right.
- Update any of the following:
  - **Border** — change the border colour and style.
  - **Background colour** — set the fill (e.g., green = already implemented).
  - **Description** — add or edit the capability description.
  - **Parent node** — re-assign to a different parent to move it in the hierarchy.
- **Delete** — there is also a delete option in the Properties Panel to remove the node directly from there.
- Changes save automatically.

---

## Step 5 — Multi-Select to Bulk-Update Nodes

> **[SCREENSHOT: Multiple nodes selected and turned green — callout explaining what green means]**

- Hold `Shift` and click each node, **or** click and drag to select a group.
- Set the background colour to **green** in the Properties Panel → marks the entire capability category as already implemented by the client.
- All selected nodes update simultaneously.

Colour convention used across engagements:
- 🟢 Green = Already implemented
- 🟡 Amber = In progress
- 🔴 Red = Not started / gap

---

## Step 6 — Manual Node Editing (Add, Edit, Delete)

> **[SCREENSHOT: Right-click context menu on the canvas showing Add / Edit / Delete options]**

**Add a node:**
- Right-click an empty area → **Add Node**.
- Fill in the name, description, and parent, then click **Create**.

**Edit a node:**
- Double-click the node (or use the Properties Panel).
- Update the label or description and confirm with **Save**.

**Delete a node:**
- Select the node and press `Delete` / `Backspace`, **or** right-click → **Delete Node**.
- Confirm in the prompt.

---

## Step 7 — AI-Assisted Editing

> **[SCREENSHOT: AI chat / prompt input bar open on the canvas]**

- Open the **AI Assistant** panel from the toolbar.
- Type a plain-English instruction and the AI proposes the change in a diff preview.
- Click **Apply** to confirm or **Reject** to discard.

**Example prompts:**
- *"Add a new capability node called 'Digital Onboarding' under 'Customer Channels'"*
- *"Rename 'Legacy Core Banking' to 'Core Banking Platform' and set its background to amber"*
- *"Remove the node 'Manual Reconciliation' from the canvas"*

---

## Step 8 — Save the Diagram as a Template

> **[SCREENSHOT: Save as Template modal open]**

When I've built a capability map I want to reuse across engagements, I click **Save as Template** from the canvas toolbar. A modal opens showing exactly how many capabilities are about to be saved (e.g., *"12 capabilities will be saved"*).

I fill in the following fields:

- **Template Name** *(required)* — I give it a clear, reusable name, e.g., *"Banking Capability Map v1"*. If I leave this blank and try to save, the form shows a validation error: *"Please enter a template name."*
- **Category** — I pick the industry from a dropdown:
  - Banking & Finance, Healthcare, Retail & Consumer, Technology & Software, Insurance, Manufacturing, Energy & Utilities, Government & Public Sector, Telecoms, Other.
- **Description** *(optional)* — I add a short note like *"L1–L3 capabilities for a retail bank engagement"* so teammates know what the template covers.

A summary pill at the bottom of the form shows the total node count and how many levels are included (e.g., *"12 capabilities across 3 levels"*).

- Click **Save template** → a green success screen appears briefly (*"Template saved! '[name]' has been saved to your templates."*) and the modal closes automatically.
- Click **Cancel** to close without saving.

---

## Step 9 — Using a Saved Template

> **[SCREENSHOT: Saved Templates / Template Picker modal — list of templates with category colour badges]**

When I start a new diagram or want to load a previous structure, I open the **Template Picker**. It shows all my saved templates with:

- **Template name** and **category badge** (colour-coded by industry).
- **Node count** and the **date it was saved**.
- Clicking a template loads all its capability nodes directly onto the canvas — I can then edit, extend, or colour-code it for the current client.

---

## Step 10 — Exporting the Diagram

> **[SCREENSHOT: Export page showing all three sections — View & Duplicate, Visual Export, Data Export]**

Once the map is ready, I click **Export** from the top menu. I have the following options:

**View & Duplicate**
- **View Link** — I can generate a read-only shareable URL and send it to stakeholders so they can view the map in the browser without editing it.
- **Duplicate Link** — I can create an editable copy of the diagram for a teammate to branch independently without touching the original.

**Visual Export**
- **PNG** — I download the map as a raster image to drop into slides, Word docs, or share over chat.
- **SVG** — I export a scalable vector version when the image needs to be resized without losing quality in design tools.
- **PDF** — I export a print-ready document for executive reviews or client printouts.

**Data Export**
- **JSON** — I export the full node, edge, and layout data for technical handoff or re-importing into another workspace.
- **CSV** — I get a flat tabular file to load into spreadsheets or BI tools.
- **Excel** — I export a workbook that preserves the capability hierarchy and metadata — useful when the client wants the data back in a structured spreadsheet.

---

## Quick Reference — Actions at a Glance

| Task | How |
|---|---|
| Add node | Right-click canvas → Add Node |
| Edit node | Select → Properties Panel |
| Delete node | Select → Delete key |
| Bulk colour change | Multi-select → Properties Panel |
| AI edit | AI Assistant panel → type instruction → Apply |
| Save as Template | Canvas toolbar → Save as Template |
| Load a saved template | Start new diagram → Template Picker |
| Zoom | Toolbar zoom controls / scroll wheel |
| Save diagram | Auto-save / Ctrl+S |
| Export | Top menu → Export |

---

*Insert your screenshots at each placeholder above and annotate using your preferred tool (e.g., Snagit, Loom, Figma).*

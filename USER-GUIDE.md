# CapMap — User Guide

> **What is CapMap?**
> CapMap is a tool for consultants to turn a capability spreadsheet into a visual, interactive map — and edit it using plain English. No coding, no design tools, no sign-up required.

---

## Getting Started

1. Open the app in your browser.
2. You're ready to go — **no account needed.**
3. Your work is automatically saved in your browser and restored if you refresh the page.

---

## Step 1 — Upload Your Spreadsheet

- Click **Upload** or drag and drop your `.xlsx` or `.csv` file onto the page.
- Your file must have columns for capability levels: **L0, L1, L2, L3** (and an optional Description column).
- The file stays on your computer — it is never sent to any server.
- Limit: **5 MB** file size, **500 nodes** maximum.

**Example spreadsheet layout:**

| L0 | L1 | L2 | L3 |
|----|----|----|-----|
| Customer Experience | Loyalty | Points Management | Tier Calculation |
| Customer Experience | Loyalty | Points Management | Redemption |
| Finance | Planning | Budgeting | |

> If your file has formatting issues, you'll see a clear message explaining what to fix.

---

## Step 2 — View Your Capability Map

After uploading, your capabilities appear as a **colour-coded visual map**:

| Level | Colour | Example |
|-------|--------|---------|
| L0 | Dark navy | Customer Experience |
| L1 | Blue | Loyalty |
| L2 | Light blue | Points Management |
| L3 | Pale blue | Tier Calculation |

**Navigating the map:**
- **Pan** — click and drag the background to move around.
- **Zoom** — scroll with your mouse wheel or pinch on a trackpad.
- **Click a node** — see its details (level, parent, description) in the right panel.
- **Show/hide levels** — use the left sidebar to toggle L0, L1, L2, or L3 on or off.

---

## Step 3 — Edit the Map Manually

You can make changes directly without using AI:

- **Drag** any node to reposition it on the canvas.
- **Rename** a node by clicking it and editing the name in the right panel.
- **Add** a new node under any selected parent using the sidebar.
- **Delete** a node (and its children if needed) via the sidebar.

All changes are held in memory — nothing is saved to the database until you click **Apply**.

---

## Step 4 — Edit with AI (Plain English)

Type what you want to change in the **Prompt Box** at the bottom and press Enter.

**Example prompts:**
- *"Add a Loyalty Program capability under Customer Experience"*
- *"Remove all sub-capabilities under Legacy Finance"*
- *"Rename 'Digital Channels' to 'Omnichannel Delivery'"*
- *"Add three capabilities under Technology: Cloud Infrastructure, Cybersecurity, and Data Platforms"*

**What happens next:**
1. The AI reads your current map and your instruction.
2. It proposes changes — shown as a **ghost preview** on the canvas (new nodes appear dashed; removed nodes appear faded out).
3. A **Preview Panel** lists every proposed change colour-coded:
   - 🟢 **Green (+)** — new nodes being added
   - 🔴 **Red (−)** — nodes being removed
   - 🟡 **Amber (~)** — nodes being renamed

You stay in control — nothing changes until **you approve it**.

---

## Step 5 — Approve or Reject AI Changes

After reviewing the Preview Panel:

| Button | What it does |
|--------|-------------|
| **Apply** | Confirms all changes. The map updates and is saved to the database. |
| **Cancel** | Discards all proposed changes. The map returns to exactly how it was. |

---

## Undo & Redo

Made a mistake? No problem.

- **Ctrl + Z** (Windows) / **Cmd + Z** (Mac) — Undo the last change.
- **Ctrl + Y** (Windows) / **Cmd + Y** (Mac) — Redo an undone change.

Undo history is available for the current session. It resets when you close the browser tab.

---

## Auto-Save (No Data Loss on Refresh)

- Your work is automatically saved to your browser every few seconds.
- If you **refresh the page**, your map reloads exactly as you left it.
- When you click **Apply**, the map is saved to the database and the auto-draft is cleared.
- Auto-drafts expire after **7 days** of inactivity.

---

## Export Your Map

### PNG Image
- Click **Export → PNG** to download your map as an image.
- Ready to paste into a presentation, email, or document.

### JSON (Save & Reload)
- Click **Export → JSON** to save a copy of your map as a file.
- You can re-upload this file later to pick up exactly where you left off.
- Useful for sharing a map with a colleague.

---

## Your Data is Private

- All catalogs you create are visible **only to you** in your browser.
- No other user can see or access your maps.
- Your session is identified by a private ID stored in your browser — not tied to an account.

---

## Troubleshooting

| Problem | What to do |
|---------|-----------|
| File upload fails | Check that your file has L0/L1/L2/L3 column headers. |
| Map looks empty after upload | Make sure at least one L0 value is filled in. |
| AI prompt changes nothing | Try rephrasing your prompt more specifically. |
| Map not loading after refresh | Clear your browser cache and re-upload your file. |
| "Missing Supabase URL" error | Contact your administrator — the app needs environment configuration. |

---

## Glossary

| Term | Meaning |
|------|---------|
| **Capability** | A business function or activity (e.g., "Customer Onboarding") |
| **L0 / L1 / L2 / L3** | Hierarchy levels — L0 is the top-level group, L3 is the most detailed |
| **Canvas** | The visual area where your capability map is displayed |
| **Diff / Preview** | A list of AI-proposed changes before you approve them |
| **Apply** | Confirms and saves all pending changes |
| **Ghost node** | A dashed/faded node showing a change proposal that hasn't been approved yet |
| **Session** | Your current browser session — your private workspace |

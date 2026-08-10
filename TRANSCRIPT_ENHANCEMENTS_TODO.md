# Transcript Enhancements — Coding TODO

> **Prerequisites:**
> 1. Run [scripts/migrations/2026-08-04_transcript_enhancements.sql](scripts/migrations/2026-08-04_transcript_enhancements.sql) in Supabase SQL editor.
> 2. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='meeting_transcripts' AND column_name IN ('context_prompt','template_id');` → 2 rows.
> 3. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='capability_catalogs' AND column_name='notes';` → 1 row.
>
> **Reference docs:** [TRANSCRIPT_TECHNICAL_GUIDE.md](TRANSCRIPT_TECHNICAL_GUIDE.md)

---

## Fix 1 — Modal z-index / portal issue

**Problem:** `TranscriptReviewModal` renders inside overflow-hidden containers (AIMapEditor sidebar, RightSidebar). The `fixed inset-0` CSS gets clipped.

**Fix:** Wrap the modal return in a React portal to `document.body`.

### File: `src/components/transcript/TranscriptReviewModal.tsx`

At the top, add:
```ts
import { createPortal } from "react-dom";
```

At the bottom of the component, change the return from:
```tsx
return (
  <div className="fixed inset-0 z-50 ...">
    ...
  </div>
);
```
to:
```tsx
const modalContent = (
  <div className="fixed inset-0 z-50 ...">
    ...
  </div>
);
return typeof window !== "undefined" ? createPortal(modalContent, document.body) : null;
```

- [ ] Test: Open transcript modal from AI editor sidebar — modal covers full viewport.
- [ ] Test: Open from RightSidebar empty state — same result.
- [ ] Test: Open from homepage card — still works (portal is harmless when not inside a clipping parent).

---

## Fix 2 — Context prompt / specifications textarea

### 2a. Update types

**File: `src/types/transcript.ts`**

Add `context_prompt` to `MeetingTranscript` interface:
```ts
export interface MeetingTranscript {
  // ...existing fields...
  context_prompt: string | null;  // ← ADD after raw_text
  // ...
}
```

- [ ] Type added.

### 2b. Update TranscriptUpload component

**File: `src/components/transcript/TranscriptUpload.tsx`**

Add a new textarea between the metadata inputs and the submit button:

```tsx
{/* Context & specifications */}
<div>
  <label className="mb-1 block text-xs font-medium text-slate-600">
    Context & specifications (optional)
  </label>
  <textarea
    value={contextPrompt}
    onChange={(e) => setContextPrompt(e.target.value)}
    placeholder={`e.g. "Sarah is from our team, John is the client. When John says 'we have X', mark green. When he says 'we need X', mark red."`}
    rows={3}
    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
  />
</div>
```

State: `const [contextPrompt, setContextPrompt] = useState("");`

Include in the POST body: add `contextPrompt` to the JSON payload and FormData.

- [ ] Textarea renders in the modal.
- [ ] Value sent to API.

### 2c. Update API route to accept & store context_prompt

**File: `src/app/api/transcripts/route.ts`**

In the POST handler:
- JSON body: read `body.contextPrompt`
- Multipart: read `form.get("contextPrompt")`
- Insert into `meeting_transcripts` row as `context_prompt`.

- [ ] Column populated after upload.

### 2d. Feed context_prompt into LLM passes

**File: `src/lib/transcript/pipeline.ts`**

Read `tx.context_prompt` from the transcript row. Pass it to:
- `pass1Filter(cleaned, contextPrompt)` — so it knows which speakers to keep/drop
- `pass2Extract(filtered, mode, { ...ctx, contextPrompt })` — so it can generate SET_STYLE + SET_LEGEND commands based on speaker rules
- `pass3Todos(filtered, pass2Summary, contextPrompt)` — so it can attribute TODOs to "our team" vs "client"

**File: `src/lib/transcript/pass1-filter.ts`**

Add optional `contextPrompt` param. If present, append to system prompt:
```
Additional context from user:
<contextPrompt>
```

**File: `src/lib/transcript/pass2-extract.ts`**

Add `contextPrompt?: string` to the `ctx` parameter. In edit_diagram mode, append to system prompt:
```
User specifications:
<contextPrompt>

Follow these rules when generating SET_STYLE and SET_LEGEND commands:
- Use the color mappings specified above
- Emit SET_LEGEND for any new categories mentioned
- Attribute capabilities based on speaker identity rules
```

**File: `src/lib/transcript/pass3-todos.ts`**

Add optional `contextPrompt` param. If present, append to system prompt:
```
Context about meeting participants:
<contextPrompt>
Use this to determine todo ownership and priority.
```

- [ ] Test: Upload with context "John is client. When John says 'we have', use green." → Pass 2 emits SET_STYLE green + SET_LEGEND commands.
- [ ] Test: Upload without context → same behavior as before (backward compatible).

---

## Fix 3 — Template selection in new_diagram mode

### 3a. Add template picker to TranscriptUpload

**File: `src/components/transcript/TranscriptUpload.tsx`**

When `mode === "new_diagram"`, show a template selector ABOVE the paste box:

```tsx
{mode === "new_diagram" && (
  <div>
    <label className="mb-1 block text-xs font-medium text-slate-600">
      Start from template (optional)
    </label>
    <select
      value={templateId}
      onChange={(e) => setTemplateId(e.target.value)}
      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
    >
      <option value="">Blank — generate from scratch</option>
      {templates.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  </div>
)}
```

State:
```ts
const [templateId, setTemplateId] = useState("");
const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
```

On mount, fetch templates:
```ts
useEffect(() => {
  if (mode === "new_diagram") {
    fetch("/api/catalogs?isTemplate=true")
      .then(r => r.json())
      .then(data => setTemplates(data.catalogs ?? []));
  }
}, [mode]);
```

> Note: Check if `/api/catalogs` already has a `isTemplate` filter or check what route lists templates. Look at `TemplatePickerModal` for reference — it likely fetches from a similar endpoint. Reuse that.

Include `templateId` in the POST body.

- [ ] Template dropdown shows available templates.
- [ ] Value sent to API.

### 3b. Update API to store template_id

**File: `src/app/api/transcripts/route.ts`**

Read `templateId` from body/form, insert as `template_id` on the row.

- [ ] Column populated.

### 3c. Pipeline: load template capabilities when template_id is set

**File: `src/lib/transcript/pipeline.ts`**

After loading the transcript row, check `tx.template_id`:

```ts
if (tx.mode === "new_diagram" && tx.template_id) {
  // Load template capabilities — treat this like edit_diagram on the template
  const { data: templateCaps } = await supabase
    .from("capabilities")
    .select("*")
    .eq("catalog_id", tx.template_id)
    .eq("is_deleted", false);
  capabilities = templateCaps ?? [];
}
```

Then in the `pass2Extract` call:
- If `mode === "new_diagram"` AND `capabilities.length > 0` (template loaded):
  - Use `edit_diagram` extraction logic (pass the template tree as context)
  - The LLM will emit commands (ADD_NODE, RENAME_NODE, SET_STYLE, etc.) against the template
  - Store proposals as `kind='command'` instead of `kind='node'`
- If `mode === "new_diagram"` AND no template:
  - Use `new_diagram` extraction logic as before (proposals are `kind='node'`)

This means the review modal will show the **Commands** tab instead of the **Nodes** tab when a template is selected.

### 3d. Apply: create catalog from template + apply commands

**File: `src/lib/transcript/applyNew.ts`**

Update the logic:

```ts
if (templateId) {
  // 1. Clone the template: create new catalog, copy all capabilities
  // 2. Apply accepted command proposals via executeCommands()
  // 3. Return the new catalogId
} else {
  // Existing logic: build from node proposals
}
```

Cloning a template:
```ts
async function cloneTemplate(templateId: string, userId: string, title: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  // Copy catalog row
  const { data: template } = await supabase
    .from("capability_catalogs")
    .select("*")
    .eq("id", templateId)
    .single();

  const { data: newCatalog } = await supabase
    .from("capability_catalogs")
    .insert({
      user_id: userId,
      name: title,
      description: template.description,
      status: "active",
    })
    .select("id")
    .single();

  // Copy capabilities with new IDs mapped
  const { data: caps } = await supabase
    .from("capabilities")
    .select("*")
    .eq("catalog_id", templateId)
    .eq("is_deleted", false)
    .order("level")
    .order("sort_order");

  const oldToNew = new Map<string, string>();
  for (const cap of caps ?? []) {
    const newId = crypto.randomUUID();
    oldToNew.set(cap.id, newId);
  }

  const newCaps = (caps ?? []).map(cap => ({
    id: oldToNew.get(cap.id)!,
    catalog_id: newCatalog.id,
    parent_id: cap.parent_id ? oldToNew.get(cap.parent_id) ?? null : null,
    level: cap.level,
    name: cap.name,
    description: cap.description,
    note: cap.note,
    sort_order: cap.sort_order,
    source: "transcript_template",
  }));

  await supabase.from("capabilities").insert(newCaps);
  return newCatalog.id;
}
```

Then apply commands on the cloned catalog using `applyEdit` logic.

- [ ] Test: Select template + upload transcript → review shows Commands tab → apply → new diagram = template + modifications.
- [ ] Test: No template selected → still shows Nodes tab → works as before.

---

## Fix 4 — Change tracking notes on nodes

When `applyEdit.ts` or `applyNew.ts` applies commands from a transcript, append a tracking note to affected nodes.

### 4a. In `src/lib/transcript/applyEdit.ts`

After `executeCommands()` succeeds, for each command that touched a node, append to its `capabilities.note`:

```ts
const transcriptNote = `[Transcript: "${txTitle}" ${new Date().toLocaleDateString()}]`;

// For ADD_NODE commands — set note on new node
// For RENAME_NODE — append "Renamed via transcript"
// For DELETE_NODE — (node is deleted, no note needed)
// For SET_STYLE — append "Style updated via transcript"
// For REPARENT_NODE — append "Moved via transcript"
```

Implementation:
```ts
for (const cmd of commands) {
  const nodeId = 'nodeId' in cmd ? cmd.nodeId : ('tempId' in cmd ? cmd.tempId : null);
  if (!nodeId) continue;

  let action = "";
  switch (cmd.type) {
    case "ADD_NODE": action = "Added"; break;
    case "RENAME_NODE": action = "Renamed"; break;
    case "SET_STYLE": case "SET_TEXT_COLOR": action = "Style updated"; break;
    case "REPARENT_NODE": action = "Moved"; break;
    case "SET_NOTE": continue; // don't overwrite explicit notes
    case "SET_DESCRIPTION": action = "Description updated"; break;
    default: continue;
  }

  const stamp = `${action} via transcript "${txRow?.title}" on ${new Date().toLocaleDateString()}`;
  const { data: cap } = await supabase.from("capabilities").select("note").eq("id", nodeId).single();
  if (cap) {
    const note = [cap.note, stamp].filter(Boolean).join("\n");
    await supabase.from("capabilities").update({ note }).eq("id", nodeId);
  }
}
```

### 4b. In `src/lib/transcript/applyNew.ts`

For the template flow (cloned + commands applied), do the same as 4a.

For the pure new_diagram flow (no template), add a note on every created node:
```ts
const stamp = `Created via transcript "${tx?.title}" on ${new Date().toLocaleDateString()}`;
```

- [ ] Test: Apply edit transcript → check a renamed node → note shows "Renamed via transcript 'Sprint 24 Review' on 8/4/2026".
- [ ] Test: Apply new diagram → check any node → note shows "Created via transcript ...".

---

## Fix 5 — Catalog-level notes (per-diagram freeform notes)

### 5a. Update types

**File: `src/types/capability.ts`**

Add to `CapabilityCatalog` interface:
```ts
notes: string | null;
```

### 5b. API endpoint for reading/updating notes

**File: `src/app/api/catalogs/[id]/notes/route.ts`** (new file)

```ts
// GET — return current notes
// PATCH — update notes text
```

Implementation:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await getSupabaseAdmin()
    .from("capability_catalogs")
    .select("notes")
    .eq("id", params.id)
    .single();

  return NextResponse.json({ notes: data?.notes ?? "" });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { notes } = await req.json();
  if (typeof notes !== "string") {
    return NextResponse.json({ error: "notes must be a string" }, { status: 400 });
  }

  await getSupabaseAdmin()
    .from("capability_catalogs")
    .update({ notes })
    .eq("id", params.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] GET returns current notes.
- [ ] PATCH updates notes.

### 5c. UI — Notes panel in the canvas

**File: `src/components/canvas/CatalogNotesPanel.tsx`** (new file)

A collapsible panel (or modal) accessible from the canvas toolbar. Shows a textarea with auto-save on blur or debounced typing.

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";

interface Props {
  catalogId: string;
  open: boolean;
  onClose: () => void;
}

export default function CatalogNotesPanel({ catalogId, open, onClose }: Props) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && catalogId) {
      fetch(`/api/catalogs/${catalogId}/notes`)
        .then(r => r.json())
        .then(d => setNotes(d.notes ?? ""));
    }
  }, [open, catalogId]);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/catalogs/${catalogId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
  }, [catalogId, notes]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Diagram Notes</h2>
          <button onClick={() => { save(); onClose(); }} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          rows={12}
          placeholder="Add notes about this diagram — decisions, context, change history…"
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">{saving ? "Saving…" : "Auto-saves on blur"}</span>
          <button onClick={save} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5d. Add "Notes" button to canvas toolbar

**File: `src/app/(routes)/dashboard/page.tsx`**

Find the toolbar row (where Export, History, Properties buttons are). Add a "Notes" button that opens `CatalogNotesPanel`.

Look for the existing buttons (likely near `historyPanelOpen` toggle) and add:
```tsx
<button onClick={() => setNotesOpen(true)} className="...">
  <svg ...>📝</svg> Notes
</button>
```

State: `const [notesOpen, setNotesOpen] = useState(false);`

Render: `<CatalogNotesPanel catalogId={storeCatalogId!} open={notesOpen} onClose={() => setNotesOpen(false)} />`

- [ ] "Notes" button visible in toolbar.
- [ ] Click opens modal with editable textarea.
- [ ] Notes persist across page reloads.

---

## Fix 6 — TranscriptReviewModal tab logic for template mode

When `mode === "new_diagram"` AND a template was selected:
- The modal should show **Commands** tab (not Nodes tab) because proposals are `kind='command'`
- Summary tab and TODOs tab remain the same

**File: `src/components/transcript/TranscriptReviewModal.tsx`**

Change the tab logic:
```ts
// Before:
const tabs: Tab[] = mode === "new_diagram" ? ["summary", "nodes", "todos"] : ["summary", "commands", "todos"];

// After:
const hasNodes = proposals.nodes.length > 0;
const hasCommands = proposals.commands.length > 0;
const tabs: Tab[] = hasCommands
  ? ["summary", "commands", "todos"]
  : hasNodes
  ? ["summary", "nodes", "todos"]
  : ["summary", "todos"];
```

Also set default tab dynamically:
```ts
useEffect(() => {
  if (proposals.commands.length > 0) setTab("commands");
  else if (proposals.nodes.length > 0) setTab("nodes");
}, [proposals]);
```

- [ ] Template selected + transcript → Commands tab shows.
- [ ] No template → Nodes tab shows (unchanged behavior).

---

## Execution order

1. Run SQL migration (prerequisite)
2. Fix 1 — Portal (quick, unblocks testing)
3. Fix 2 — Context prompt (textarea + API + pipeline changes)
4. Fix 3 — Template selection (upload UI + pipeline + apply logic)
5. Fix 4 — Change tracking notes (apply flows)
6. Fix 5 — Catalog notes (API + UI + toolbar)
7. Fix 6 — Tab logic (small change in modal)

## Verification checklist

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Modal covers full viewport from AI editor
- [ ] Context prompt: "Mark green when client says 'we have'" → green SET_STYLE commands emitted
- [ ] Template flow: pick template → transcript adds leaf nodes → new diagram = template + additions
- [ ] Node notes show "Added via transcript ..." after apply
- [ ] Catalog notes: editable, persists, visible from toolbar

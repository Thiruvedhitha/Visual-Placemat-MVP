# Visual Placemat MVP — Demo Walkthrough Script

---

## Scene 1: Upload Page (`/documents`)

**Action:** Open the app → land on the upload page.

> "This is where you bring in your capability catalog. Just drag and drop your Excel file — it's parsed instantly in your browser, nothing hits the server yet."

**Action:** Drag in an `.xlsx` file.

> "The system validates the format — it looks for L0 through L3 columns and optionally a Description column. You get an instant preview showing the hierarchy."

**Action:** Point to the green "Format matched" banner and the preview table.

> "You can see it detected all four levels plus descriptions. The table shows a sample of your data — parent levels and leaf capabilities."

**Action:** Click **Continue to Canvas →**

> "When you hit Continue, the file is converted into a capability tree locally — stored in your browser using Zustand. No database call happens here. This means it's instant and you won't lose your work if you refresh."

---

## Scene 2: How the Visual Map is Constructed (Under the Hood)

**Action:** As the canvas loads, narrate the pipeline.

> "Let me show you what just happened behind the scenes in about 50 milliseconds."

**Action:** Show a simplified diagram or just narrate with gestures.

> "Step 1 — The Excel file was parsed right here in the browser using SheetJS. It read the header row, found L0 through L3 columns, and produced a flat array of rows — each row has l0, l1, l2, l3, and description fields."

> "Step 2 — Those flat rows were converted into a proper capability tree. The converter walks each row, tracks the current L0/L1/L2 context, and builds full-path keys like '2:Strategy Management/Portfolio Management/Budget Mgmt' to guarantee unique parent-child relationships — even if two capabilities have the same name under different parents."

> "Step 3 — Each capability gets a temporary client-side ID and a parent_id pointing to its parent's temp ID. The whole array — along with the catalog name and a 'dirty' flag — is pushed into a Zustand store that automatically persists to localStorage."

**Action:** Open browser DevTools → Application → Local Storage → show `visual-placemat-catalog` key.

> "Here it is in localStorage — the full state including all 47 capabilities, their hierarchy, and the dirty flag. This is why you can refresh the page and still see your map."

> "Step 4 — The dashboard reads this array from Zustand, passes it to the layout engine, which builds a parent-child tree, assigns hierarchical numbers like 1.1.1.1, and calculates X/Y positions for every node. L0 headers span the top, L1 columns sit side by side underneath, L2/L3 stack vertically in each column."

> "Step 5 — Those positioned nodes are handed to React Flow, which renders the canvas you see now. The entire pipeline — parse, convert, store, layout, render — runs in the browser with zero server calls."

---

## Scene 3: Canvas (`/dashboard`)

**Action:** Canvas loads with the full capability map rendered.

> "Here's your capability map visualized. Each L0 domain is a navy header spanning its sub-columns. L1s sit below as column headers, and L2/L3 capabilities stack vertically underneath."

**Action:** Point out the layout structure.

> "The layout is automatic — the engine positions everything based on the hierarchy. L0 at the top, L1 columns side by side, L2 and L3 stacked within each column."

---

## Scene 3: Layer Toggles (Left Sidebar)

**Action:** Toggle off L3 in the left sidebar.

> "You can toggle visibility of any level. Turn off L3 to get a higher-level view — just domains, groups, and subgroups. Turn it back on to see the full detail."

**Action:** Toggle L3 back on.

---

## Scene 4: Node Inspection (Right Sidebar)

**Action:** Click on any L3 node (e.g., "Program Project Alignment").

> "Click any node to inspect it. The right panel shows the selected capability's name, its level, parent, and description pulled from the Excel file."

**Action:** Point to the right sidebar fields.

> "You can customize the fill color, border color, and add a note — all of these edits happen locally, nothing is saved to the database yet."

**Action:** Change the border color or add a note.

---

## Scene 5: The Apply Button

**Action:** Point to the green "Apply" button in the header.

> "Notice the Apply button is green — that means you have unsaved changes. Everything so far lives in your browser's local storage. If you refresh right now, your map is still here."

**Action:** Click **Apply**.

> "When you click Apply, that's when we bulk-save everything to the database in one transaction — the catalog metadata and all capabilities with their hierarchy preserved."

**Action:** Button changes to "Saved" (greyed out).

> "Now it says 'Saved' — your map is persisted in Supabase. If you close the tab and come back, it loads from the database."

---

## Scene 6: Interaction Modes

**Action:** Switch between Select and Pan in the toolbar.

> "You have two interaction modes — Select mode lets you click nodes to inspect them. Pan mode lets you drag the canvas around. You can also scroll to zoom in and out."

---

## Scene 7: Export

**Action:** Click the **Export** button.

> "When you're happy with the map, hit Export to generate a PNG image you can share with stakeholders."

---

## Summary (30-second pitch)

> "So the full flow is: upload your Excel → it's parsed and visualized instantly with zero server calls → you explore, toggle layers, inspect nodes, customize → when ready, hit Apply to save to the database. It's local-first, fast, and you never lose work."

---

## Key Points to Emphasize

| Point | Why it matters |
|-------|---------------|
| Browser-only parsing | No upload latency, instant feedback |
| Local-first (Zustand + localStorage) | No data loss on refresh, fast edits |
| Apply = single bulk save | User controls when DB is touched |
| Automatic layout engine | No manual positioning needed |
| Layer toggles | See high-level or detailed view on demand |

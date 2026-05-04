const XLSX = require("xlsx");
const path = require("path");

// ─── DATA ────────────────────────────────────────────────────────────────────
// type: "feature" | "sub"
// indent: 0 = top-level feature, 1 = sub-feature
const rows = [
  // ── 1. No Authentication ──────────────────────────────────────────────────
  { no: "1",   indent: 0, name: "No Authentication (MVP)",           description: "The app is open to anyone. No sign-up or sign-in required.",                                                          owner: "Frontend" },
  { no: "1.1", indent: 1, name: "Session ID Generation",             description: "A unique session ID is generated on first visit and stored in the browser (localStorage).",                          owner: "Frontend" },
  { no: "1.2", indent: 1, name: "Data Isolation per Session",        description: "Each user's catalogs are visible only in their own browser session — no user can access another's data.",            owner: "Frontend" },
  { no: "1.3", indent: 1, name: "Persistent Session",                description: "Session ID persists across page refreshes and browser restarts (same browser only).",                               owner: "Frontend" },

  // ── 2. Catalog Management ─────────────────────────────────────────────────
  { no: "2",   indent: 0, name: "Catalog Management",                description: "Users can create and list capability catalogs within their session.",                                                 owner: "Full Stack" },
  { no: "2.1", indent: 1, name: "Create a Catalog",                  description: "User creates a catalog by uploading an Excel file. Optionally provides client name, catalog name, and industry.",    owner: "Frontend" },
  { no: "2.2", indent: 1, name: "List Catalogs",                     description: "Dashboard shows all catalogs belonging to the current session — name, industry tag, node count, last updated.",      owner: "Frontend" },

  // ── 3. Spreadsheet Upload & Parsing ───────────────────────────────────────
  { no: "3",   indent: 0, name: "Spreadsheet Upload & Parsing",      description: "Users upload .xlsx or .csv files which are parsed entirely in the browser into a capability hierarchy.",             owner: "Frontend" },
  { no: "3.1", indent: 1, name: "File Upload",                       description: "Upload via drag-drop or file picker. Max 5 MB. File never leaves the browser.",                                      owner: "Frontend" },
  { no: "3.2", indent: 1, name: "Parsing",                           description: "SheetJS reads the Excel buffer. Columns detected by regex (/L0/i, /L1/i …). Each row → flat record {l0,l1,l2,l3,description}. Empty cells inherit from the row above.", owner: "Frontend" },
  { no: "3.3", indent: 1, name: "Validation on Upload",              description: "At least one L0 must be present. No level skipping (L2 needs L1). Max 500 nodes. Clear error messages on failure.", owner: "Frontend" },

  // ── 4. Canvas — Visual Map ────────────────────────────────────────────────
  { no: "4",   indent: 0, name: "Canvas — Visual Map",               description: "Interactive node graph rendering the full L0–L3 capability hierarchy using React Flow.",                             owner: "Frontend" },
  { no: "4.1", indent: 1, name: "Render",                            description: "Colour-coded nodes by level: L0 dark navy, L1 blue, L2 light blue, L3 pale blue.",                                  owner: "Frontend" },
  { no: "4.2", indent: 1, name: "Auto Layout",                       description: "Layout engine calculates x,y positions automatically. L0 = wide column headers, L1 = sub-columns, L2/L3 = vertical stacks. Recalculates after every edit.", owner: "Frontend" },
  { no: "4.3", indent: 1, name: "Interaction",                       description: "Pan (drag background), Zoom (scroll/pinch), Node click (details in sidebar), Level toggles (left sidebar).",        owner: "Frontend" },
  { no: "4.4", indent: 1, name: "Ghost Preview (AI edits)",          description: "AI-proposed additions appear dashed/faded. Removals shown with reduced opacity and strikethrough. Disappears on Cancel; becomes solid on Apply.", owner: "Frontend" },

  // ── 5. Manual Editing ─────────────────────────────────────────────────────
  { no: "5",   indent: 0, name: "Manual Editing",                    description: "Users can directly edit the capability map without using AI prompts.",                                               owner: "Frontend" },
  { no: "5.1", indent: 1, name: "Drag & Drop",                       description: "Drag nodes to reposition them on the canvas. Position saved in Zustand (in-memory).",                               owner: "Frontend" },
  { no: "5.2", indent: 1, name: "Add / Remove / Rename Nodes",       description: "Right-click or sidebar to add a node under a selected parent. Delete a node (and children). Rename inline. No DB call until Apply.", owner: "Frontend" },

  // ── 6. AI Prompt Editing ──────────────────────────────────────────────────
  { no: "6",   indent: 0, name: "AI Prompt Editing",                 description: "Users type plain-English instructions to edit the map via an AI-powered backend pipeline.",                         owner: "Full Stack" },
  { no: "6.1", indent: 1, name: "Prompt Input",                      description: "Text box for natural language instructions. Send via Enter or button. Loading spinner during processing.",           owner: "Frontend" },
  { no: "6.2", indent: 1, name: "Backend Pipeline",                  description: "POST prompt + nodes + industry → Embed (OpenAI) → pgvector similarity search → Context Builder → Claude Sonnet 4 → JSON diff → Diff Normalizer → return clean diff.", owner: "Backend" },
  { no: "6.3", indent: 1, name: "Diff Validation",                   description: "Zod schema check. Parent level rules (L1→L0, L2→L1, L3→L2). Orphan check. Cycle check (DFS). Auto-retry up to 2 times. Error toast on total failure.", owner: "Backend" },

  // ── 7. Preview Panel & Apply ──────────────────────────────────────────────
  { no: "7",   indent: 0, name: "Preview Panel & Apply",             description: "Human-approval step showing proposed AI changes before committing them.",                                            owner: "Frontend" },
  { no: "7.1", indent: 1, name: "Diff Summary",                      description: "Colour-coded list: Green (+) additions, Red (−) removals, Amber (~) renames. Each row shows node name, level badge, parent name.", owner: "Frontend" },
  { no: "7.2", indent: 1, name: "Apply",                             description: "Commits diff to Zustand atomically, saves undo snapshot, then saves to Supabase: UPSERT catalogs, bulk INSERT capabilities, INSERT visual_maps, INSERT diff_history (status=applied).", owner: "Full Stack" },
  { no: "7.3", indent: 1, name: "Cancel",                            description: "Discards diff and ghost nodes. Canvas reverts. diff_history row inserted with status=cancelled.",                   owner: "Frontend" },

  // ── 8. Auto-Draft ─────────────────────────────────────────────────────────
  { no: "8",   indent: 0, name: "Auto-Draft (Data Loss Prevention)",  description: "Zustand state is continuously auto-saved to localStorage to prevent data loss on page refresh.",                   owner: "Frontend" },
  { no: "8.1", indent: 1, name: "Auto-Save to localStorage",         description: "State saved every few seconds. Restored automatically on page refresh.",                                             owner: "Frontend" },
  { no: "8.2", indent: 1, name: "Draft Expiry",                      description: "Auto-drafts expire after 7 days of inactivity. Cleared immediately on Apply.",                                       owner: "Frontend" },

  // ── 9. Export ────────────────────────────────────────────────────────────
  { no: "9",   indent: 0, name: "Export",                           description: "Users can download the capability map in different formats — all generated in the browser.",                         owner: "Frontend" },
  { no: "9.1", indent: 1, name: "PNG Export",                       description: "Exports the React Flow canvas as a PNG image using html-to-image. Immediate browser download, no server call.",      owner: "Frontend" },
  { no: "9.2", indent: 1, name: "JSON Save / Load",                 description: "Export: serialises nodes to a .json file. Import: upload a JSON to restore the map. Useful for sharing without DB access.", owner: "Frontend" },

  // ── 10. Infrastructure ────────────────────────────────────────────────────
  { no: "10",   indent: 0, name: "Infrastructure",                   description: "Hosting, database, AI services, and state management choices for the MVP.",                                          owner: "DevOps" },
  { no: "10.1", indent: 1, name: "Frontend — Next.js 14 on Vercel",  description: "App Router, auto-deploy on push, edge CDN.",                                                                         owner: "DevOps" },
  { no: "10.2", indent: 1, name: "Database — Supabase",              description: "Managed PostgreSQL + pgvector. RLS built-in. Vector similarity search for RAG.",                                     owner: "Backend" },
  { no: "10.3", indent: 1, name: "AI — Claude Sonnet 4",             description: "Anthropic API. Best structured JSON output for diff generation.",                                                    owner: "Backend" },
  { no: "10.4", indent: 1, name: "Embeddings — text-embedding-3-small", description: "OpenAI API. Fast, 1536 dimensions, pgvector compatible.",                                                        owner: "Backend" },
  { no: "10.5", indent: 1, name: "State — Zustand",                  description: "Fast in-memory state with persist middleware for localStorage auto-draft.",                                          owner: "Frontend" },

  // ── 11. Database Tables ───────────────────────────────────────────────────
  { no: "11",   indent: 0, name: "Database Tables",                  description: "Core MVP tables in Supabase PostgreSQL.",                                                                             owner: "Backend" },
  { no: "11.1", indent: 1, name: "capability_catalogs",              description: "One row per uploaded catalog. Stores name, industry, client name, user session ID.",                                 owner: "Backend" },
  { no: "11.2", indent: 1, name: "capabilities",                     description: "All L0–L3 capability nodes. Stores level, name, description, parent_id, sort_order, source.",                       owner: "Backend" },
  { no: "11.3", indent: 1, name: "visual_maps",                      description: "Layout snapshots — one row per version. Stores layout_data JSON and is_active flag.",                               owner: "Backend" },
  { no: "11.4", indent: 1, name: "diff_history",                     description: "Audit log of every AI prompt. Stores prompt text, diff payload, and status (applied / cancelled).",                 owner: "Backend" },

  // ── 12. Excluded from MVP ─────────────────────────────────────────────────
  { no: "12",   indent: 0, name: "Excluded from MVP (v2+)",          description: "Features intentionally left out of the MVP to reduce scope and complexity.",                                         owner: "Product" },
  { no: "12.1", indent: 1, name: "Sign Up / Sign In",                description: "No authentication in MVP. Added in v2 via Supabase Auth (email+password, Google OAuth, SSO).",                     owner: "Product" },
  { no: "12.2", indent: 1, name: "Multi-user Collaboration",         description: "Not needed for solo consultant workflow in MVP. Added in v2.",                                                       owner: "Product" },
  { no: "12.3", indent: 1, name: "SLM Routing (Phi-3 / Llama)",      description: "Single LLM is simpler to debug in MVP. SLM classifier added in v2.",                                               owner: "Product" },
  { no: "12.4", indent: 1, name: "Graph DB (Neo4j)",                 description: "pgvector alone is sufficient for MVP. Neo4j added in v2 for richer relationship queries.",                          owner: "Product" },
  { no: "12.5", indent: 1, name: "Undo / Redo",                      description: "In-session and cross-session undo/redo moved to full application release. See Complete Application Features.",       owner: "Product" },
  { no: "12.6", indent: 1, name: "Cross-Session Undo",               description: "Diff-replay undo across browser sessions. Added in v2.",                                                             owner: "Product" },
  { no: "12.7", indent: 1, name: "PPTX / SVG / PDF Export",          description: "PNG is sufficient for MVP. Additional export formats added in v2.",                                                 owner: "Product" },
  { no: "12.8", indent: 1, name: "Admin Dashboard",                  description: "No admin needed until multi-tenant. Added in v3.",                                                                   owner: "Product" },
  { no: "12.9", indent: 1, name: "Notifications",                    description: "No real-time events in MVP. Added in v3.",                                                                           owner: "Product" },
  { no: "12.10", indent: 1, name: "Mobile / Tablet Layout",          description: "Desktop-first for consultants in MVP. Mobile layout added in v3.",                                                  owner: "Product" },
];

// ─── BUILD WORKSHEET DATA ────────────────────────────────────────────────────
// Layout: Serial No | Feature | Sub-Feature | Description | Owner
// Top-level rows: name in col B, col C blank
// Sub-feature rows:  col B blank, name in col C

const wsData = [
  ["Serial No", "Feature", "Sub-Feature", "Description", "Owner"],
  ...rows.map((r) => [
    r.no,
    r.indent === 0 ? r.name : "",   // Feature column
    r.indent === 1 ? r.name : "",   // Sub-Feature column
    r.description,
    r.owner,
  ]),
];

const ws = XLSX.utils.aoa_to_sheet(wsData);

// Column widths
ws["!cols"] = [
  { wch: 10 },  // Serial No
  { wch: 38 },  // Feature
  { wch: 38 },  // Sub-Feature
  { wch: 80 },  // Description
  { wch: 14 },  // Owner
];

// Freeze top row (header)
ws["!freeze"] = { xSplit: 0, ySplit: 1 };

// ─── WORKBOOK ────────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "MVP Features");

const outPath = path.join(__dirname, "..", "MVP-Features.xlsx");
XLSX.writeFile(wb, outPath);
console.log("✅  Excel written to:", outPath);

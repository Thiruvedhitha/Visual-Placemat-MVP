const XLSX = require("xlsx");
const path = require("path");

// ─── DATA ────────────────────────────────────────────────────────────────────
// indent: 0 = top-level feature, 1 = sub-feature
const rows = [

  // ── 1. Authentication & Getting Started ───────────────────────────────────
  { no: "1",    indent: 0, name: "Authentication & Getting Started",  description: "How users access the application." },
  { no: "1.1",  indent: 1, name: "No Account (Session-based Access)", description: "App is open to anyone. Unique session ID generated on first visit and stored in localStorage. Data isolated per browser." },
  { no: "1.2",  indent: 1, name: "Sign In — Email & Password",        description: "Users create an account with email and password. Access their work from any computer." },
  { no: "1.3",  indent: 1, name: "Sign In — Google / Microsoft OAuth",description: "One-click login for enterprise users via Google or Microsoft OAuth." },
  { no: "1.4",  indent: 1, name: "Password Reset",                    description: "Reset password via email link if credentials are forgotten." },
  { no: "1.5",  indent: 1, name: "Enterprise SSO (SAML/OIDC)",        description: "Company IT team connects CapMap to existing corporate login systems." },
  { no: "1.6",  indent: 1, name: "Two-Factor Authentication",         description: "Extra security layer for sensitive client work." },
  { no: "1.7",  indent: 1, name: "Organisation Accounts",             description: "Firm has one account; all consultants join it under an org hierarchy." },

  // ── 2. Catalog Management ─────────────────────────────────────────────────
  { no: "2",    indent: 0, name: "Catalog Management",                 description: "Creating, organising, and sharing capability catalogs." },
  { no: "2.1",  indent: 1, name: "Create a Catalog (Upload Excel)",    description: "User creates a catalog by uploading an .xlsx or .csv file. Optionally provides client name, catalog name, and industry." },
  { no: "2.2",  indent: 1, name: "List Catalogs",                      description: "Dashboard shows all catalogs belonging to the current user — name, industry tag, node count, last updated." },
  { no: "2.3",  indent: 1, name: "Archive Catalog",                    description: "Archive a catalog when a project is done. Archived catalogs can be restored later." },
  { no: "2.4",  indent: 1, name: "Share a Catalog",                    description: "Share a catalog with a colleague. Assign view or edit access. Shared catalogs show in recipient's dashboard." },
  { no: "2.5",  indent: 1, name: "Industry Templates",                 description: "Start from a pre-built industry template (e.g., Banking Strategy Map) instead of uploading from scratch." },
  { no: "2.6",  indent: 1, name: "Activity Feed",                      description: "See who edited what and when on any shared catalog." },
  { no: "2.7",  indent: 1, name: "Client Workspaces",                  description: "Group multiple catalogs under one client (e.g., Standard Chartered has a Strategy map and an Operations map)." },
  { no: "2.8",  indent: 1, name: "Invite Client Contacts (Read-Only)", description: "Invite external client contacts as read-only viewers so they can review the map." },
  { no: "2.9",  indent: 1, name: "Compare Two Catalogs",               description: "Side-by-side diff showing what was added, removed, or changed between two catalog versions or clients." },

  // ── 3. Spreadsheet Upload & Parsing ───────────────────────────────────────
  { no: "3",    indent: 0, name: "Spreadsheet Upload & Parsing",       description: "Users upload .xlsx or .csv files which are parsed into a capability hierarchy." },
  { no: "3.1",  indent: 1, name: "File Upload",                        description: "Upload via drag-drop or file picker. Max 5 MB. File is parsed entirely in the browser — never sent to any server." },
  { no: "3.2",  indent: 1, name: "Parsing",                            description: "SheetJS reads the Excel buffer. Columns detected by regex (/L0/i, /L1/i …). Each row → flat record {l0,l1,l2,l3,description}. Empty cells inherit from the row above." },
  { no: "3.3",  indent: 1, name: "Validation on Upload",               description: "At least one L0 must be present. No level skipping (L2 needs L1). Max 500 nodes. Clear error messages on failure." },

  // ── 4. Canvas — Visual Map ────────────────────────────────────────────────
  { no: "4",    indent: 0, name: "Canvas — Visual Map",                description: "Interactive node graph rendering the full L0–L3 capability hierarchy." },
  { no: "4.1",  indent: 1, name: "Render (Colour-Coded Nodes)",        description: "L0 = dark navy, L1 = blue, L2 = light blue, L3 = pale blue. Colour-coded interactive map." },
  { no: "4.2",  indent: 1, name: "Auto Layout",                        description: "Layout engine calculates x,y positions automatically. L0 = wide column headers, L1 = sub-columns, L2/L3 = vertical stacks." },
  { no: "4.3",  indent: 1, name: "Pan & Zoom",                         description: "Drag background to pan. Scroll/pinch to zoom in and out." },
  { no: "4.4",  indent: 1, name: "Node Click (Sidebar Details)",       description: "Click any node to see its details in the right sidebar panel." },
  { no: "4.5",  indent: 1, name: "Level Toggles",                      description: "Show or hide L0, L1, L2, L3 independently from the left sidebar to focus on a specific level." },
  { no: "4.6",  indent: 1, name: "Ghost Preview (AI Edits)",           description: "AI-proposed additions appear dashed/faded. Removals shown with reduced opacity and strikethrough. Disappears on Cancel; becomes solid on Apply." },
  { no: "4.7",  indent: 1, name: "Drag Nodes to Reposition",           description: "Drag any node to reposition it anywhere on the canvas. Position saved in store." },
  { no: "4.8",  indent: 1, name: "Multi-Select Nodes",                 description: "Shift+click or drag a selection box to select multiple nodes at once." },
  { no: "4.9",  indent: 1, name: "Collapse / Expand Groups",           description: "Click an L0 domain to collapse or expand its children. Useful on dense maps." },
  { no: "4.10", indent: 1, name: "Minimap",                            description: "Small overview panel in the corner for large maps with 100+ nodes." },
  { no: "4.11", indent: 1, name: "Focus Mode",                         description: "Click an L0 domain to zoom into just that section, hiding the rest." },
  { no: "4.12", indent: 1, name: "Detailed Node Panel",                description: "Click a node to see: full name, description, parent, children count, last editor, and AI prompt origin." },
  { no: "4.13", indent: 1, name: "Layout Options",                     description: "Choose horizontal, vertical, radial, or compact grid layout for the canvas." },
  { no: "4.14", indent: 1, name: "Light & Dark Theme",                 description: "Toggle between light and dark colour schemes for the canvas." },
  { no: "4.15", indent: 1, name: "Custom Brand Colours",               description: "Firms can set their own brand colours per capability level." },
  { no: "4.16", indent: 1, name: "Custom Node Shapes",                 description: "Select from rectangles, rounded boxes, or hexagons for node shapes." },

  // ── 5. Manual Editing ─────────────────────────────────────────────────────
  { no: "5",    indent: 0, name: "Manual Editing",                     description: "Users can directly edit the capability map without using AI prompts." },
  { no: "5.1",  indent: 1, name: "Add Node",                           description: "Create a new capability under any existing parent via right-click or sidebar." },
  { no: "5.2",  indent: 1, name: "Remove Node",                        description: "Delete a capability node (and optionally its children). Confirmed before deletion." },
  { no: "5.3",  indent: 1, name: "Rename Node",                        description: "Rename any node inline. Changes staged until Apply." },
  { no: "5.4",  indent: 1, name: "Drag to Reposition",                 description: "Move nodes to better locations on the canvas. Position saved in memory." },

  // ── 6. AI Prompt Editing ──────────────────────────────────────────────────
  { no: "6",    indent: 0, name: "AI Prompt Editing",                  description: "Users type plain-English instructions to edit the map via an AI-powered backend pipeline." },
  { no: "6.1",  indent: 1, name: "Prompt Input",                       description: "Text box for natural language instructions. Send via Enter or button. Loading spinner during processing." },
  { no: "6.2",  indent: 1, name: "Backend Pipeline",                   description: "POST prompt + nodes + industry → Embed (OpenAI) → pgvector similarity search → Context Builder → Claude Sonnet 4 → JSON diff → Diff Normalizer → return clean diff." },
  { no: "6.3",  indent: 1, name: "Diff Validation",                    description: "Zod schema check. Parent level rules (L1→L0, L2→L1, L3→L2). Orphan check. Cycle check (DFS). Auto-retry up to 2 times. Error toast on total failure." },
  { no: "6.4",  indent: 1, name: "Smarter AI — Dual Model Routing",    description: "Simple edits (rename, single add) handled by a faster model; complex edits by a more powerful one. Transparent to user." },
  { no: "6.5",  indent: 1, name: "Prompt History",                     description: "See every AI instruction ever given for a catalog, with the outcome (applied / cancelled)." },
  { no: "6.6",  indent: 1, name: "Repeat a Prompt",                    description: "Re-run any previous instruction with one click." },
  { no: "6.7",  indent: 1, name: "Bookmark Prompts",                   description: "Save frequently used instructions as named shortcuts for quick access." },
  { no: "6.8",  indent: 1, name: "Conversation Mode",                  description: "Have a back-and-forth dialogue with the AI about the map rather than single one-shot prompts." },
  { no: "6.9",  indent: 1, name: "AI Reasoning Transparency",          description: "Ask the AI 'why did you add this?' and see the full reasoning and source references." },
  { no: "6.10", indent: 1, name: "Batch Prompts",                      description: "Queue multiple instructions, run them all at once, and review all proposed changes together." },
  { no: "6.11", indent: 1, name: "Proactive AI Suggestions",           description: "System proactively suggests improvements (e.g., 'Your map is missing Regulatory Compliance — it appears in 11/14 banking maps')." },

  // ── 7. Preview Panel & Apply ──────────────────────────────────────────────
  { no: "7",    indent: 0, name: "Preview Panel & Apply",              description: "Human-approval step showing proposed AI changes before committing them." },
  { no: "7.1",  indent: 1, name: "Diff Summary",                       description: "Colour-coded list: Green (+) additions, Red (−) removals, Amber (~) renames. Each row shows node name, level badge, parent name." },
  { no: "7.2",  indent: 1, name: "Apply",                              description: "Commits the diff atomically, saves an undo snapshot, then persists to the database: UPSERT catalogs, bulk INSERT capabilities, INSERT visual map version, INSERT diff history (status=applied)." },
  { no: "7.3",  indent: 1, name: "Cancel",                             description: "Discards diff and ghost nodes. Canvas reverts to previous state. Diff history row inserted with status=cancelled." },
  { no: "7.4",  indent: 1, name: "Auto-Draft (Data Loss Prevention)",  description: "State is continuously auto-saved to localStorage to prevent data loss on page refresh or tab crash. Drafts expire after 7 days." },
  { no: "7.5",  indent: 1, name: "Approval Workflow",                  description: "For large engagements, a senior consultant must approve changes before they become official. States: Draft → Pending Approval → Approved / Rejected." },

  // ── 8. Undo & Redo ────────────────────────────────────────────────────────
  { no: "8",    indent: 0, name: "Undo & Redo",                        description: "Keyboard shortcuts and history-based controls to revert or re-apply changes to the capability map." },
  { no: "8.1",  indent: 1, name: "In-Session Undo (Ctrl+Z)",           description: "Restores the previous snapshot. Undo stack holds up to 50 snapshots per session." },
  { no: "8.2",  indent: 1, name: "In-Session Redo (Ctrl+Y)",           description: "Re-applies the most recently undone snapshot. Canvas re-renders immediately." },
  { no: "8.3",  indent: 1, name: "Session Boundary",                   description: "Undo history is cleared when the browser tab is closed. Refreshing the page keeps the current map state (auto-draft) but clears the undo stack." },
  { no: "8.4",  indent: 1, name: "Cross-Session Undo",                 description: "Even after closing the browser, users can undo previous changes because full history is stored in the database." },
  { no: "8.5",  indent: 1, name: "Undo a Specific Past Change",        description: "Pick any past edit from the history list and reverse it — not limited to the most recent change." },

  // ── 9. Version History ────────────────────────────────────────────────────
  { no: "9",    indent: 0, name: "Version History",                    description: "Track, browse, and restore past versions of the capability map." },
  { no: "9.1",  indent: 1, name: "Version List (Last 10)",             description: "Sidebar shows the last 10 saved versions of the map. Each shows version number, prompt that created it, and timestamp." },
  { no: "9.2",  indent: 1, name: "Restore Version",                    description: "Restore any previous version of the map with one click." },
  { no: "9.3",  indent: 1, name: "Compare Two Versions",               description: "See exactly what was added, removed, or renamed between any two versions." },
  { no: "9.4",  indent: 1, name: "Export Change Log",                  description: "Download a PDF or PPTX showing what changed between versions." },
  { no: "9.5",  indent: 1, name: "Full Audit Trail",                   description: "Every action logged: uploads, edits, exports, who did what and when." },
  { no: "9.6",  indent: 1, name: "Immutable Audit Log",                description: "Audit log cannot be deleted. Required for compliance and governance." },
  { no: "9.7",  indent: 1, name: "Export Audit Log as CSV",            description: "Download the full immutable audit trail as a CSV file for reporting." },

  // ── 10. Export ────────────────────────────────────────────────────────────
  { no: "10",   indent: 0, name: "Export",                             description: "Download or push the capability map to external formats and systems." },
  { no: "10.1", indent: 1, name: "PNG Image",                          description: "Download the canvas as a PNG image. Runs entirely in the browser." },
  { no: "10.2", indent: 1, name: "JSON Save / Load",                   description: "Export: serialises nodes to a .json file. Import: upload a JSON to restore the map." },
  { no: "10.3", indent: 1, name: "PowerPoint (PPTX)",                  description: "Generates a slide deck with one slide per L0 domain." },
  { no: "10.4", indent: 1, name: "SVG",                                description: "Vector image that stays sharp at any zoom level." },
  { no: "10.5", indent: 1, name: "Excel Reconstruction",               description: "Rebuilds the original spreadsheet format from the current map state." },
  { no: "10.6", indent: 1, name: "CSV",                                description: "Flat list of all capabilities with level and parent exported as CSV." },
  { no: "10.7", indent: 1, name: "PDF",                                description: "Styled document of the full capability map." },
  { no: "10.8", indent: 1, name: "Custom PowerPoint Template",         description: "Firms upload a branded PPTX template; all exports automatically use it." },
  { no: "10.9", indent: 1, name: "Confluence Integration",             description: "Push the map as a structured wiki page to Confluence. Updates sync automatically." },
  { no: "10.10",indent: 1, name: "Miro Integration",                   description: "Push the map to a Miro board as sticky notes." },
  { no: "10.11",indent: 1, name: "SharePoint / Teams Integration",     description: "Export directly to SharePoint or post a summary card to a Teams channel." },
  { no: "10.12",indent: 1, name: "REST API (Pull Catalog Data)",       description: "Developers can pull catalog data programmatically via a REST API." },
  { no: "10.13",indent: 1, name: "Webhooks",                           description: "Trigger external notifications when a map is updated." },
  { no: "10.14",indent: 1, name: "Public API",                         description: "Full developer documentation for third-party integrations." },
  { no: "10.15",indent: 1, name: "Marketplace Integrations",           description: "Pre-built integrations for ServiceNow, Salesforce, Jira, and other enterprise tools." },

  // ── 11. AI Knowledge Base ─────────────────────────────────────────────────
  { no: "11",   indent: 0, name: "AI Knowledge Base",                  description: "The curated repository of capability patterns that powers AI editing suggestions." },
  { no: "11.1", indent: 1, name: "Industry-Filtered Knowledge Base",   description: "AI uses a knowledge base filtered by industry — banking prompts only retrieve banking knowledge." },
  { no: "11.2", indent: 1, name: "Pre-Loaded Industry Templates",      description: "Knowledge base pre-loaded with Strategy, Finance, Operations patterns per industry." },
  { no: "11.3", indent: 1, name: "Knowledge Growth over Time",         description: "Every approved map contributes anonymised capability patterns back to the shared knowledge base." },
  { no: "11.4", indent: 1, name: "Knowledge Base Admin Panel",         description: "AI Developers can view, add, edit, and remove knowledge base entries via an admin panel." },
  { no: "11.5", indent: 1, name: "Structural Knowledge",               description: "System learns which capabilities typically sit together (e.g., Risk Management always has Credit Risk children)." },
  { no: "11.6", indent: 1, name: "Frequency-Ranked Suggestions",       description: "Suggestions ranked by how often they appear across maps (e.g., 'Credit Risk — 14/14 banking maps')." },
  { no: "11.7", indent: 1, name: "Import Industry Frameworks",         description: "Load standard frameworks like TOGAF, BIAN (banking), HL7 (healthcare) as knowledge base content." },
  { no: "11.8", indent: 1, name: "Knowledge Analytics",                description: "Dashboard showing which topics have best coverage and which industries need more templates." },
  { no: "11.9", indent: 1, name: "RAG Hit Rate Tracking",              description: "Track how often the AI finds high-quality matches in the knowledge base for any given prompt." },

  // ── 12. Quality & Validation ──────────────────────────────────────────────
  { no: "12",   indent: 0, name: "Quality & Validation",               description: "Rules and checks that ensure capability maps are structurally correct." },
  { no: "12.1", indent: 1, name: "Structural Validation",              description: "Every L1 must have an L0 parent, L2→L1, L3→L2. No orphan nodes. No circular references." },
  { no: "12.2", indent: 1, name: "Auto-Retry on Invalid AI Output",    description: "If AI produces an invalid diff, the system automatically retries up to 2 times before showing an error toast." },
  { no: "12.3", indent: 1, name: "Duplicate Detection",                description: "Warns if a capability with the same name already exists under the same parent." },
  { no: "12.4", indent: 1, name: "Naming Rules",                       description: "Firms can enforce naming conventions (e.g., all L1 names must end in 'Management')." },
  { no: "12.5", indent: 1, name: "Consistency Check",                  description: "Flags when the same concept is named slightly differently across multiple maps." },
  { no: "12.6", indent: 1, name: "Custom Validation Rules",            description: "Admins define their own rules (warnings or hard blocks) via a visual editor. Example: 'No L1 can have more than 8 children'." },

  // ── 13. Administration ────────────────────────────────────────────────────
  { no: "13",   indent: 0, name: "Administration",                     description: "Tools for managing users, roles, system settings, and organisation-wide policies." },
  { no: "13.1", indent: 1, name: "Invite Users to Organisation",       description: "Admin invites new users to the organisation account by email." },
  { no: "13.2", indent: 1, name: "Remove Users",                       description: "Remove a user from the organisation and optionally reassign their catalogs." },
  { no: "13.3", indent: 1, name: "View All Org Catalogs",              description: "Admins can view all catalogs across the organisation (read-only)." },
  { no: "13.4", indent: 1, name: "Set Available Industries",           description: "Admins choose which industry options appear in the dropdown when creating a catalog." },
  { no: "13.5", indent: 1, name: "Full Admin Panel",                   description: "Central dashboard for user management, roles, billing, knowledge base, and system settings." },
  { no: "13.6", indent: 1, name: "System Prompt Management",           description: "Edit the AI's core instructions without involving engineers." },
  { no: "13.7", indent: 1, name: "Validation Rule Editor",             description: "Create and manage custom validation rules via a visual editor — no coding needed." },
  { no: "13.8", indent: 1, name: "Export Watermarking",                description: "Auto-embed the firm's logo on all PNG and PPTX exports." },
  { no: "13.9", indent: 1, name: "Mandatory Fields",                   description: "Require consultants to enter an engagement code or other fields when creating a catalog." },

  // ── 14. Notifications ─────────────────────────────────────────────────────
  { no: "14",   indent: 0, name: "Notifications",                      description: "Alerting users to activity within shared catalogs and workflows." },
  { no: "14.1", indent: 1, name: "In-App Notifications",               description: "Alerts when someone edits a shared catalog, shares a catalog with you, or comments on a node." },
  { no: "14.2", indent: 1, name: "Email Notifications",                description: "Daily activity digest, approval workflow alerts, and weekly knowledge base updates via email." },

  // ── 15. Comments & Collaboration ──────────────────────────────────────────
  { no: "15",   indent: 0, name: "Comments & Collaboration",           description: "Real-time and asynchronous collaboration features for teams working on shared maps." },
  { no: "15.1", indent: 1, name: "Comment on Any Node",                description: "Add a note, question, or action item to a specific capability node." },
  { no: "15.2", indent: 1, name: "Threaded Replies",                   description: "Conversations stay organized per node with threaded reply chains." },
  { no: "15.3", indent: 1, name: "Presence Indicator",                 description: "See an avatar when another user is currently viewing or editing the same catalog." },
  { no: "15.4", indent: 1, name: "Node Locking",                       description: "If one user is editing a node, it is locked for other users until they finish." },
  { no: "15.5", indent: 1, name: "Annotation Mode",                    description: "Place sticky-note-style comments anywhere on the canvas (not tied to a node). Useful for workshops and client presentations." },
  { no: "15.6", indent: 1, name: "Export with Annotations",            description: "Export the map with or without canvas annotations included." },

  // ── 16. Infrastructure ────────────────────────────────────────────────────
  { no: "16",   indent: 0, name: "Infrastructure",                     description: "Hosting, database, AI services, and state management powering the application." },
  { no: "16.1", indent: 1, name: "Frontend — Next.js 14 on Vercel",    description: "App Router, auto-deploy on push, edge CDN." },
  { no: "16.2", indent: 1, name: "Database — Supabase (PostgreSQL)",   description: "Managed PostgreSQL + pgvector. RLS built-in. Vector similarity search for RAG." },
  { no: "16.3", indent: 1, name: "AI — Claude Sonnet 4",               description: "Anthropic API for structured JSON diff generation." },
  { no: "16.4", indent: 1, name: "Embeddings — text-embedding-3-small",description: "OpenAI API. 1536 dimensions, pgvector compatible." },
  { no: "16.5", indent: 1, name: "State — Zustand",                    description: "Fast in-memory state with persist middleware for localStorage auto-draft." },
  { no: "16.6", indent: 1, name: "SLM Routing (Phi-3 / Llama)",        description: "SLM classifier routes simple prompts to a fast local model and complex prompts to Claude." },
  { no: "16.7", indent: 1, name: "Graph DB — Neo4j",                   description: "Added alongside pgvector for richer capability relationship queries." },
  { no: "16.8", indent: 1, name: "Mobile / Tablet Layout",             description: "Responsive layout optimised for tablet and mobile devices." },
];

// ─── BUILD WORKSHEET DATA ────────────────────────────────────────────────────
// Layout: Serial No | Feature | Sub-Feature | Description
const wsData = [
  ["Serial No", "Feature", "Sub-Feature", "Description"],
  ...rows.map((r) => [
    r.no,
    r.indent === 0 ? r.name : "",   // Feature column
    r.indent === 1 ? r.name : "",   // Sub-Feature column
    r.description,
  ]),
];

const ws = XLSX.utils.aoa_to_sheet(wsData);

// ─── COLUMN WIDTHS ────────────────────────────────────────────────────────────
ws["!cols"] = [
  { wch: 10 },  // Serial No
  { wch: 40 },  // Feature
  { wch: 40 },  // Sub-Feature
  { wch: 90 },  // Description
];

// Freeze top row (header)
ws["!freeze"] = { xSplit: 0, ySplit: 1 };

// ─── WORKBOOK ────────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Complete App Features");

const outPath = path.join(__dirname, "..", "Complete-App-Features.xlsx");
XLSX.writeFile(wb, outPath);
console.log("✅  Excel written to:", outPath);

/**
 * scripts/seed-builtin-template.js
 *
 * Seeds an Excel file as a built-in template by calling the running
 * Next.js dev server (localhost:3000). The server handles the Supabase
 * connection so no direct DB credentials are needed here.
 *
 * Usage (dev server must be running on port 3000):
 *   node scripts/seed-builtin-template.js [path-to-file.xlsx] [template-name]
 *
 * Examples:
 *   node scripts/seed-builtin-template.js
 *   node scripts/seed-builtin-template.js sample.xlsx "Strategic Portfolio Management"
 */

const fs   = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const BASE_URL = "http://localhost:3000";

// ── Config ─────────────────────────────────────────────────────────────────

const filePath = process.argv[2] || path.join(__dirname, "../sample.xlsx");
const nameArg = process.argv[3] || null;

if (!fs.existsSync(filePath)) {
  console.error(`\n❌  File not found: ${filePath}`);
  console.error("    Place sample.xlsx in the project root and run again.\n");
  process.exit(1);
}

// ── Parse Excel ────────────────────────────────────────────────────────────

function parseExcel(fp) {
  const wb = XLSX.read(fs.readFileSync(fp), { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  if (!rows.length) throw new Error("Excel file appears to be empty.");
  return { headers: Object.keys(rows[0]), rows };
}

function findLCols(headers) {
  return headers.filter((h) => /^l\d+/i.test(h.trim().replace(/\s.*/, "")));
}

function findDescCol(headers) {
  return headers.find((h) => /desc/i.test(h)) ?? null;
}

// ── Convert rows → capabilities ────────────────────────────────────────────
// Mirrors src/lib/parser/rowsToCapabilities.ts

let counter = 0;
function tempId() {
  return `tmp_${Date.now()}_${++counter}`;
}

function convertRowsToCapabilities(headers, rows) {
  const lCols = findLCols(headers);
  const descCol = findDescCol(headers);
  if (lCols.length === 0) throw new Error("No L-level columns found (L0, L1, L2…).");

  const currentNames = new Array(4).fill(null);
  const pathToId = new Map();
  const capabilities = [];
  const sortOrders = new Array(4).fill(0);

  for (const row of rows) {
    for (let lvl = 0; lvl < lCols.length; lvl++) {
      const value = (row[lCols[lvl]] ?? "").trim();
      if (!value) continue;

      currentNames[lvl] = value;
      for (let j = lvl + 1; j < 4; j++) currentNames[j] = null;

      const pathParts = currentNames.slice(0, lvl + 1).filter(Boolean);
      const selfKey = `${lvl}:${pathParts.join("/")}`;
      if (pathToId.has(selfKey)) continue;

      let parentId = null;
      if (lvl > 0) {
        const parentParts = currentNames.slice(0, lvl).filter(Boolean);
        const parentKey = `${lvl - 1}:${parentParts.join("/")}`;
        parentId = pathToId.get(parentKey) ?? null;
      }

      const id = tempId();
      pathToId.set(selfKey, id);
      sortOrders[lvl] = (sortOrders[lvl] ?? 0) + 1;

      capabilities.push({
        id,
        parent_id: parentId,
        level: lvl,
        name: value,
        description: descCol ? (row[descCol] ?? "").trim() || null : null,
        note: null,
        sort_order: sortOrders[lvl],
        source: "xlsx_import",
      });
    }
  }
  return capabilities;
}

// ── Seed via Next.js API ──────────────────────────────────────────────────

async function seed() {
  console.log(`\n📂  Reading: ${filePath}`);
  const { headers, rows } = parseExcel(filePath);

  const templateName = nameArg || path.basename(filePath, path.extname(filePath));
  console.log(`📋  Template name : "${templateName}"`);
  console.log(`📊  Rows parsed   : ${rows.length}`);

  const capabilities = convertRowsToCapabilities(headers, rows);
  console.log(`🔢  Capabilities  : ${capabilities.length}`);

  // Step 1: save via /api/catalogs/save
  console.log(`\n⬆️   POSTing to ${BASE_URL}/api/catalogs/save ...`);
  const saveRes = await fetch(`${BASE_URL}/api/catalogs/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      catalogId: null,
      catalogName: templateName,
      capabilities,
      nodeStyles: {},
      clientName: "__builtin__",
    }),
  });

  const saveData = await saveRes.json().catch(() => ({}));
  if (!saveRes.ok) throw new Error("Save failed: " + (saveData.error ?? saveRes.status));

  const catalogId = saveData.catalogId;
  console.log(`✅  Saved catalog (id: ${catalogId})`);

  // Step 2: promote to built-in via /api/catalogs/templates
  console.log(`⬆️   Promoting to built-in template ...`);
  const promoteRes = await fetch(`${BASE_URL}/api/catalogs/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catalogId }),
  });

  const promoteData = await promoteRes.json().catch(() => ({}));
  if (!promoteRes.ok) throw new Error("Promote failed: " + (promoteData.error ?? promoteRes.status));

  console.log(`\n🎉  Done! "${templateName}" is now a built-in template.`);
  console.log("    It will appear in the TemplatePickerModal for every user.\n");
}

seed().catch((err) => {
  console.error("\n❌  Seed failed:", err.message);
  console.error("    Make sure the dev server is running on http://localhost:3000\n");
  process.exit(1);
});

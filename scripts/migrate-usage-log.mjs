/**
 * One-time migration: uploads usage-log.json entries to Supabase ai_usage_log table.
 *
 * Usage:
 *   node scripts/migrate-usage-log.mjs
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const USAGE_LOG_PATH = path.join(process.cwd(), "usage-log.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "❌  Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running."
  );
  process.exit(1);
}

if (!fs.existsSync(USAGE_LOG_PATH)) {
  console.error("❌  usage-log.json not found at", USAGE_LOG_PATH);
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(USAGE_LOG_PATH, "utf-8"));
console.log(`📦  Found ${entries.length} entries in usage-log.json`);

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Insert in batches of 100 to avoid request size limits
const BATCH_SIZE = 100;
let inserted = 0;

for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE);
  const { error } = await supabase.from("ai_usage_log").insert(batch);
  if (error) {
    console.error(`❌  Error inserting batch ${i}–${i + batch.length}:`, error.message);
    process.exit(1);
  }
  inserted += batch.length;
  console.log(`✅  Inserted ${inserted} / ${entries.length}`);
}

console.log(`\n🎉  Migration complete. ${inserted} entries uploaded to Supabase.`);

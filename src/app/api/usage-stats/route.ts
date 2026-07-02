import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

interface UsageEntry {
  timestamp: string;
  model: string;
  mode: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export async function GET() {
  const { data: entries, error } = await supabaseAdmin
    .from("ai_usage_log")
    .select("timestamp, model, mode, prompt_tokens, completion_tokens, total_tokens, cost_usd")
    .order("timestamp", { ascending: true });

  if (error) {
    // Table may not exist yet — return empty state instead of crashing
    console.warn("[Usage Stats] Supabase error:", error.message);
    return NextResponse.json({ entries: [], summary: null, byMode: {}, byDay: {} });
  }

  const rows: UsageEntry[] = entries ?? [];

  if (rows.length === 0) {
    return NextResponse.json({ entries: [], summary: null, byMode: {}, byDay: {} });
  }

  const totalRequests = rows.length;
  const totalPromptTokens = rows.reduce((s, e) => s + e.prompt_tokens, 0);
  const totalCompletionTokens = rows.reduce((s, e) => s + e.completion_tokens, 0);
  const totalTokens = rows.reduce((s, e) => s + e.total_tokens, 0);
  const totalCost = rows.reduce((s, e) => s + e.cost_usd, 0);

  // Per-mode breakdown
  const byMode: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const e of rows) {
    if (!byMode[e.mode]) byMode[e.mode] = { requests: 0, tokens: 0, cost: 0 };
    byMode[e.mode].requests++;
    byMode[e.mode].tokens += e.total_tokens;
    byMode[e.mode].cost += e.cost_usd;
  }

  // Daily breakdown
  const byDay: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const e of rows) {
    const day = e.timestamp.slice(0, 10);
    if (!byDay[day]) byDay[day] = { requests: 0, tokens: 0, cost: 0 };
    byDay[day].requests++;
    byDay[day].tokens += e.total_tokens;
    byDay[day].cost += e.cost_usd;
  }

  return NextResponse.json({
    summary: {
      totalRequests,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCostUsd: parseFloat(totalCost.toFixed(6)),
    },
    byMode,
    byDay,
    entries: rows.slice(-50).reverse(), // last 50 most recent first
  });
}

export async function DELETE() {
  const { error } = await supabaseAdmin
    .from("ai_usage_log")
    .delete()
    .neq("id", 0); // delete all rows

  if (error) {
    return NextResponse.json({ error: "Failed to clear log" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

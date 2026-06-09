import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const USAGE_LOG_PATH = path.join(process.cwd(), "usage-log.json");

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
  if (!fs.existsSync(USAGE_LOG_PATH)) {
    return NextResponse.json({ entries: [], summary: null });
  }

  let entries: UsageEntry[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(USAGE_LOG_PATH, "utf-8"));
  } catch {
    return NextResponse.json({ error: "Failed to parse usage log" }, { status: 500 });
  }

  const totalRequests = entries.length;
  const totalPromptTokens = entries.reduce((s, e) => s + e.prompt_tokens, 0);
  const totalCompletionTokens = entries.reduce((s, e) => s + e.completion_tokens, 0);
  const totalTokens = entries.reduce((s, e) => s + e.total_tokens, 0);
  const totalCost = entries.reduce((s, e) => s + e.cost_usd, 0);

  // Per-mode breakdown
  const byMode: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const e of entries) {
    if (!byMode[e.mode]) byMode[e.mode] = { requests: 0, tokens: 0, cost: 0 };
    byMode[e.mode].requests++;
    byMode[e.mode].tokens += e.total_tokens;
    byMode[e.mode].cost += e.cost_usd;
  }

  // Daily breakdown
  const byDay: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const e of entries) {
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
    entries: entries.slice(-50).reverse(), // last 50 most recent first
  });
}

export async function DELETE() {
  try {
    if (fs.existsSync(USAGE_LOG_PATH)) {
      fs.writeFileSync(USAGE_LOG_PATH, "[]");
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to clear log" }, { status: 500 });
  }
}

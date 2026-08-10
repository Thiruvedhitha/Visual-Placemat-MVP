import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { parseVtt } from "@/lib/transcript/parseVtt";
import { parseDocx } from "@/lib/transcript/parseDocx";
import type { TranscriptMode } from "@/types/transcript";

export const runtime = "nodejs";

// GET /api/transcripts?limit=20&offset=0&catalogId=xxx
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");
  const catalogId = searchParams.get("catalogId");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("meeting_transcripts")
    .select("id, title, meeting_date, mode, status, progress, summary, catalog_id, created_at, completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (catalogId) query = query.eq("catalog_id", catalogId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transcripts: data ?? [] });
}

// POST /api/transcripts
// Accepts JSON: { mode, title?, meetingDate?, text, catalogId? }
// Accepts multipart/form-data: file (.txt/.docx/.vtt) + mode + title? + meetingDate? + catalogId?
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let mode: TranscriptMode;
  let title: string | undefined;
  let meetingDate: string | undefined;
  let catalogId: string | undefined;
  let rawText: string;
  let contextPrompt: string | undefined;
  let templateId: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    mode = (form.get("mode") as TranscriptMode) ?? "new_diagram";
    title = (form.get("title") as string) || undefined;
    meetingDate = (form.get("meetingDate") as string) || undefined;
    catalogId = (form.get("catalogId") as string) || undefined;
    contextPrompt = (form.get("contextPrompt") as string) || undefined;
    templateId = (form.get("templateId") as string) || undefined;

    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    if (ext === "vtt") {
      rawText = parseVtt(buffer.toString("utf-8"));
    } else if (ext === "docx") {
      rawText = await parseDocx(buffer);
    } else {
      rawText = buffer.toString("utf-8");
    }
  } else {
    const body = await req.json();
    mode = body.mode ?? "new_diagram";
    title = body.title;
    meetingDate = body.meetingDate;
    catalogId = body.catalogId;
    contextPrompt = body.contextPrompt || undefined;
    templateId = body.templateId || undefined;
    rawText = body.text ?? "";
  }

  if (!rawText || rawText.trim().length < 200) {
    return NextResponse.json({ error: "Transcript too short (minimum 200 characters)" }, { status: 400 });
  }

  if (mode === "edit_diagram" && !catalogId) {
    return NextResponse.json({ error: "catalogId is required for edit_diagram mode" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("meeting_transcripts")
    .insert({
      user_id: user.id,
      mode,
      title: title || null,
      meeting_date: meetingDate || null,
      catalog_id: catalogId || null,
      context_prompt: contextPrompt || null,
      template_id: templateId || null,
      raw_text: rawText,
      status: "uploaded",
      progress: 0,
      current_step: "Uploaded",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id }, { status: 201 });
}

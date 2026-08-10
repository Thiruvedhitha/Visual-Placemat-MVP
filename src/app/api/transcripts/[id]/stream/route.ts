import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { runPipeline } from "@/lib/transcript/pipeline";

export const runtime = "nodejs";

// GET /api/transcripts/[id]/stream  — Server-Sent Events
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase
    .from("meeting_transcripts")
    .select("id, user_id, status")
    .eq("id", params.id)
    .single();

  if (!tx || tx.user_id !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  // If already completed/failed, stream a single done/error event and close
  if (tx.status === "completed" || tx.status === "ready_for_review") {
    const body = `data: ${JSON.stringify({ done: true, progress: 100 })}\n\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // client disconnected — ignore
        }
      };

      try {
        await runPipeline(params.id, emit);
        emit({ done: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        emit({ error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

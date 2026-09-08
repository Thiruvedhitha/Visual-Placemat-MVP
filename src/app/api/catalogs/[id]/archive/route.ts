import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { getCatalogAccess, canArchive, isPlatformAdmin, httpUnauthorized, httpForbidden, httpNotFound } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/auth/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return httpUnauthorized();

  const catalogId = params.id;
  const body = await request.json().catch(() => ({}));
  const reason: string | undefined = typeof body.reason === "string" ? body.reason.trim() : undefined;

  const access = await getCatalogAccess(catalogId, user.id);
  if (!access) return httpNotFound("Catalog not found");

  const platformAdmin = await isPlatformAdmin(user.id);
  if (!canArchive(access) && !platformAdmin) {
    return httpForbidden("Only the diagram owner or a folder admin can archive this diagram");
  }

  const db = getSupabaseAdmin();
  const { error } = await db
    .from("capability_catalogs")
    .update({
      status:         "archived",
      archived_at:    new Date().toISOString(),
      archived_by:    user.id,
      archive_reason: reason ?? null,
    })
    .eq("id", catalogId);

  if (error) {
    const missingArchiveColumns = /archived_at|archived_by|archive_reason/i.test(error.message);
    if (!missingArchiveColumns) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: fallbackError } = await db
      .from("capability_catalogs")
      .update({ status: "archived" })
      .eq("id", catalogId);

    if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 });
  }

  await logAudit({
    actorId:    user.id,
    action:     "catalog.archive",
    catalogId,
    clientId:   access.clientId,
    newValue:   { status: "archived", reason: reason ?? null },
    reason,
  });

  return NextResponse.json({ ok: true });
}

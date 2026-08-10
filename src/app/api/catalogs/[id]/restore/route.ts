import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { getCatalogAccess, canArchive, isPlatformAdmin, httpUnauthorized, httpForbidden, httpNotFound } from "@/lib/auth/authorization";
import { logAudit } from "@/lib/auth/audit";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) return httpUnauthorized();

  const catalogId = params.id;
  const db = getSupabaseAdmin();

  const { data: catalog } = await db
    .from("capability_catalogs")
    .select("id, user_id, client_id, status")
    .eq("id", catalogId)
    .single();

  if (!catalog) return httpNotFound("Catalog not found");
  if (catalog.status !== "archived") {
    return NextResponse.json({ error: "Catalog is not archived" }, { status: 409 });
  }

  const access = await getCatalogAccess(catalogId, user.id);
  if (!access) return httpNotFound();

  const platformAdmin = await isPlatformAdmin(user.id);
  if (!canArchive(access) && !platformAdmin) {
    return httpForbidden("Only the diagram owner or a folder admin can restore this diagram");
  }

  const { error } = await db
    .from("capability_catalogs")
    .update({ status: "active", archived_at: null, archived_by: null, archive_reason: null })
    .eq("id", catalogId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId:   user.id,
    action:    "catalog.restore",
    catalogId,
    clientId:  access.clientId,
    newValue:  { status: "active" },
  });

  return NextResponse.json({ ok: true });
}

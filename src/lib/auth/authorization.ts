import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { getUserClientRole } from "@/lib/db/clients";
import { NextResponse } from "next/server";

export type UserRole = "admin" | "editor" | "viewer";

export type CatalogAccess = {
  catalogId: string;
  clientId: string | null;
  ownerId: string | null;
  userRole: UserRole | null;
  isOwner: boolean;
};

export async function getCatalogAccess(
  catalogId: string,
  actorUserId: string
): Promise<CatalogAccess | null> {
  const db = getSupabaseAdmin();
  const { data: catalog } = await db
    .from("capability_catalogs")
    .select("id, user_id, client_id")
    .eq("id", catalogId)
    .single();

  if (!catalog) return null;

  const isOwner = catalog.user_id === actorUserId;
  let userRole: UserRole | null = null;

  if (catalog.client_id) {
    userRole = await getUserClientRole(catalog.client_id, actorUserId);
  } else if (isOwner) {
    userRole = "admin";
  }

  return {
    catalogId,
    clientId: catalog.client_id ?? null,
    ownerId: catalog.user_id ?? null,
    userRole: isOwner && !catalog.client_id ? "admin" : userRole,
    isOwner,
  };
}

export function canView(a: CatalogAccess): boolean {
  return !!a.userRole;
}

export function canEdit(a: CatalogAccess): boolean {
  return a.userRole === "admin" || a.userRole === "editor";
}

/** Owner of personal diagram or folder admin can archive */
export function canArchive(a: CatalogAccess): boolean {
  return a.isOwner || a.userRole === "admin";
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("user_profiles")
    .select("platform_role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.platform_role === "admin";
}

export function httpUnauthorized(msg = "Unauthorized") {
  return NextResponse.json({ error: msg }, { status: 401 });
}

export function httpForbidden(msg = "Forbidden") {
  return NextResponse.json({ error: msg }, { status: 403 });
}

export function httpNotFound(msg = "Not found") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

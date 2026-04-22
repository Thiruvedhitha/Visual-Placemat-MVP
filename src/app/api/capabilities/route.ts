import { NextRequest, NextResponse } from "next/server";
import { getCatalogCapabilities } from "@/lib/db/postgres/capabilities";

export async function GET(request: NextRequest) {
  const catalogId = request.nextUrl.searchParams.get("catalogId");

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId is required" }, { status: 400 });
  }

  try {
    const capabilities = await getCatalogCapabilities(catalogId);
    return NextResponse.json(capabilities);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

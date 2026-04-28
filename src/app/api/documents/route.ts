import { NextRequest, NextResponse } from "next/server";
import { parseCapabilityCatalog } from "@/lib/parser/excelParser";
import { createCatalog, insertCapabilitiesForCatalog, findDuplicateCatalog } from "@/lib/db/postgres/capabilities";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file." },
        { status: 400 }
      );
    }

    // Parse the file
    const buffer = await file.arrayBuffer();
    const rows = parseCapabilityCatalog(buffer);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No capability data found in the file" }, { status: 400 });
    }

    // Derive catalog name from file name (strip extension + trailing " (1)", " (2)" etc.)
    const catalogName = file.name
      .replace(/\.(xlsx|xls|csv)$/i, "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .trim();
    const industry = (formData.get("industry") as string | null) || undefined;
    const clientName = (formData.get("clientName") as string | null) || undefined;

    // 1. Content-based dedup: compare row count + L0 names against existing catalogs
    const existing = await findDuplicateCatalog(rows);
    if (existing) {
      return NextResponse.json({
        success: true,
        catalogId: existing,
        catalogName,
        capabilitiesCount: rows.length,
        duplicate: true,
      });
    }

    // 2. Create catalog record (fast — single insert)
    // user_id will be set when auth is wired up
    const catalogId = await createCatalog(catalogName, { industry, clientName });

    // 3. Fire-and-forget: insert capabilities in background
    insertCapabilitiesForCatalog(catalogId, rows).catch((err) =>
      console.error("Background capability insert failed:", err)
    );

    // 3. Return immediately so the client can navigate
    return NextResponse.json({
      success: true,
      catalogId,
      catalogName,
      capabilitiesCount: rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { getCatalogs } = await import("@/lib/db/postgres/capabilities");
    const catalogs = await getCatalogs();
    return NextResponse.json(catalogs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

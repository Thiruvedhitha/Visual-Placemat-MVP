import { NextRequest, NextResponse } from "next/server";
import { parseCapabilityCatalog } from "@/lib/parser/excelParser";
import { insertCatalogFromRows } from "@/lib/db/postgres/capabilities";

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

    // Derive catalog name from file name (strip extension)
    const catalogName = file.name.replace(/\.(xlsx|xls|csv)$/i, "").trim();

    // Insert into Supabase
    const catalogId = await insertCatalogFromRows(catalogName, rows);

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

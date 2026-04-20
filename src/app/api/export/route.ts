import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Export endpoint — not implemented yet" }, { status: 501 });
}

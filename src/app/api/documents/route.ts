import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Documents endpoint — not implemented yet" }, { status: 501 });
}

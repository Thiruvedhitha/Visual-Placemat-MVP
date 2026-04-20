import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Transform endpoint — not implemented yet" }, { status: 501 });
}

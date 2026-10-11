import { NextRequest, NextResponse } from "next/server";
import { searchMuseums } from "@/lib/goskatalog/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() || "";

  const { museums, source } = await searchMuseums(query);

  return NextResponse.json({ success: true, museums, source });
}

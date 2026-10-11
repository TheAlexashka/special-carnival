import { NextRequest, NextResponse } from "next/server";
import { searchSmb } from "@/lib/smb-search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const result = await searchSmb(q, page);
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}

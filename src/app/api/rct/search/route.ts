import { NextRequest, NextResponse } from "next/server";
import { searchRct } from "@/lib/rct";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await searchRct({
      query: searchParams.get("q") || "",
      page: Number(searchParams.get("page")) || 1,
      rows: Number(searchParams.get("rows")) || 24,
      onlyWithImages: searchParams.get("onlyImages") !== "0",
    });
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}

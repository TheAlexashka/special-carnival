import { NextRequest, NextResponse } from "next/server";
import { searchSzwa } from "@/lib/szwa";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await searchSzwa({
      query: searchParams.get("q") || "",
      type: searchParams.get("type"),
      archive: searchParams.get("archive"),
      onlyWithScans: searchParams.get("onlyWithScans") !== "0",
      page: Number(searchParams.get("page")) || 1,
      rows: Number(searchParams.get("rows")) || 24,
    });
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}

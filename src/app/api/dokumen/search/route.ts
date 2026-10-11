import { NextRequest, NextResponse } from "next/server";
import { searchDokumenBooks, type WordMode } from "@/lib/dokumen-search";

function asMode(value: unknown): WordMode | undefined {
  return value === "any" || value === "all" || value === "none" ? value : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await searchDokumenBooks({
      include: typeof body.include === "string" ? body.include.slice(0, 200) : undefined,
      includeMode: asMode(body.includeMode) || "any",
      exclude: typeof body.exclude === "string" ? body.exclude.slice(0, 200) : undefined,
      searchDescription: body.searchDescription !== false,
      onlyWithFile: Boolean(body.onlyWithFile),
      page: Math.max(1, Number(body.page) || 1),
      pageSize: Number(body.pageSize) || 24,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

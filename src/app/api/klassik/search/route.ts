import { NextRequest, NextResponse } from "next/server";
import { searchKlassik, klassikFacets } from "@/lib/klassik";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await searchKlassik({
      query: searchParams.get("q") || "",
      creator: searchParams.get("creator"),
      collection: searchParams.get("collection"),
      date: searchParams.get("date"),
      onlyImages: searchParams.get("onlyImages") !== "0",
      page: Number(searchParams.get("page")) || 1,
      rows: Number(searchParams.get("rows")) || 30,
    });
    const facets = searchParams.get("facets") === "1" ? await klassikFacets() : null;
    return NextResponse.json({ success: true, result, facets });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}

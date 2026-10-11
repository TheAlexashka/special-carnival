import { NextRequest, NextResponse } from "next/server";
import { searchEuropeana } from "@/lib/europeana";

export const dynamic = "force-dynamic";

function toYear(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value.replace(/\s/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.max(-4000, Math.min(2100, Math.round(n)));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await searchEuropeana({
      query: searchParams.get("q") || "",
      type: searchParams.get("type"),
      provider: searchParams.get("provider"),
      yearFrom: toYear(searchParams.get("yearFrom")),
      yearTo: toYear(searchParams.get("yearTo")),
      onlyOpen: searchParams.get("onlyOpen") === "1",
      newestFirst: searchParams.get("newestFirst") === "1",
      page: Number(searchParams.get("page")) || 1,
      rows: Number(searchParams.get("rows")) || 24,
    });
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}

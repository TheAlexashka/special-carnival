import { NextRequest, NextResponse } from "next/server";
import { searchExhibits } from "@/lib/goskatalog/client";
import { GK_PAGE_SIZE_OPTIONS } from "@/lib/goskatalog/constants";
import type { GkSearchFilters, TextMatchMode } from "@/lib/goskatalog/types";

function asMode(value: unknown): TextMatchMode | undefined {
  return value === "all" || value === "any" || value === "none" ? value : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const pageSizeRaw = Number(body.pageSize) || 50;
    const pageSize = GK_PAGE_SIZE_OPTIONS.includes(pageSizeRaw as (typeof GK_PAGE_SIZE_OPTIONS)[number])
      ? pageSizeRaw
      : 50;

    const filters: GkSearchFilters = {
      code: typeof body.code === "string" ? body.code.slice(0, 120) : undefined,
      title: typeof body.title === "string" ? body.title.slice(0, 200) : undefined,
      titleMode: asMode(body.titleMode) || "any",
      description: typeof body.description === "string" ? body.description.slice(0, 200) : undefined,
      descriptionMode: asMode(body.descriptionMode) || "any",
      museumIds: Array.isArray(body.museumIds) ? body.museumIds.map(Number).filter(Boolean) : undefined,
      categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds.filter((v: unknown) => typeof v === "string") : undefined,
      onlyWithPhoto: Boolean(body.onlyWithPhoto),
      page: Math.max(1, Number(body.page) || 1),
      pageSize,
    };

    const result = await searchExhibits(filters);

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

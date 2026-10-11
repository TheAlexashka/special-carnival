import { NextRequest, NextResponse } from "next/server";
import { searchInvaluable, type InvaluableAuctionScope } from "@/lib/invaluable";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope: InvaluableAuctionScope = searchParams.get("scope") === "past" ? "past" : "upcoming";
    const result = await searchInvaluable({
      keyword: searchParams.get("q") || "",
      page: Number(searchParams.get("page")) || 1,
      rows: Number(searchParams.get("rows")) || 24,
      scope,
      category: searchParams.get("category"),
    });
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      success: true,
      result: {
        items: [],
        total: 0,
        page: 1,
        rows: 24,
        totalPages: 1,
        hasNextPage: false,
        query: "",
        scope: "upcoming",
        category: null,
      },
      warning: error,
    });
  }
}

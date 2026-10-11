import { NextRequest, NextResponse } from "next/server";
import { parseKlassikUrl } from "@/lib/klassik";

export const dynamic = "force-dynamic";

/**
 * Полная карточка объекта Klassik Stiftung по id вида
 * /resources/id/object/museen/276 — тем же путём, что и вставка ссылки.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Не указан id объекта" }, { status: 400 });
    }
    const metadata = await parseKlassikUrl(`https://suche.klassik-stiftung.de/#/details?id=${id}`);
    return NextResponse.json({ success: true, object: metadata });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}

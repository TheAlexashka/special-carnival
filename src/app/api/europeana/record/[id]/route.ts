import { NextRequest, NextResponse } from "next/server";
import { getEuropeanaRecord } from "@/lib/europeana";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Europeana id выглядит как "/670/item_XXXX" — восстанавливаем путь целиком
  // из закодированного параметра.
  const { id: encoded } = await context.params;
  const id = decodeURIComponent(encoded);

  // Europeana использует id вида /{prefix}/{localId}: /670/item_XXXX,
  // /916259/BOMA_AH3484, /2021672/ABC123 — проверяем форму, а не слово item_.
  if (!/^\/[^/]+\/[^/]+$/.test(id)) {
    return NextResponse.json({ success: false, error: "Некорректный id записи" }, { status: 400 });
  }

  try {
    const record = await getEuropeanaRecord(id);
    return NextResponse.json({ success: true, record });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}

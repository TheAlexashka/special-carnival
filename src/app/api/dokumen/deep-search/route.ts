import { NextRequest, NextResponse } from "next/server";
import { deepSearchDokumen } from "@/lib/dokumen-deep";

// Глубокий поиск обращается к внешнему архивному индексу — без кеширования.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Любой ответ — строго JSON. Раньше при таймауте прокси предпросмотра отдавал
  // свою HTML-страницу, и в браузере возникала ошибка
  // «Unexpected token '<', "<!doctype "... is not valid JSON».
  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query.slice(0, 160) : "";

    if (!query.trim()) {
      return NextResponse.json(
        { success: false, error: "Введите слова для глубокого поиска" },
        { status: 400 }
      );
    }

    const result = await deepSearchDokumen(query);
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error:
          `Архивный индекс не ответил после нескольких попыток (${error}). ` +
          `Он бывает перегружен — подождите немного и нажмите кнопку ещё раз, ` +
          `обычно вторая попытка проходит.`,
      },
      { status: 200 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getExhibit } from "@/lib/goskatalog/client";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const exhibitId = Number(id);

  if (!exhibitId) {
    return NextResponse.json({ success: false, error: "Некорректный номер экспоната" }, { status: 400 });
  }

  const { exhibit, warning } = await getExhibit(exhibitId);

  if (!exhibit) {
    return NextResponse.json(
      {
        success: false,
        error:
          warning ||
          "Госкаталог не ответил на запрос карточки. Попробуйте открыть экспонат прямо на goskatalog.ru.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, exhibit });
}

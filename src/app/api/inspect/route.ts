import { NextRequest, NextResponse } from "next/server";
import { parseBookUrl } from "@/lib/parsers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Пожалуйста, укажите ссылку на книгу или документ." },
        { status: 400 }
      );
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return NextResponse.json(
        { success: false, error: "Ссылка должна начинаться с https:// или http://" },
        { status: 400 }
      );
    }

    const metadata = await parseBookUrl(url);

    return NextResponse.json({ success: true, data: metadata });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Error inspecting book URL:", error);
    return NextResponse.json(
      {
        success: false,
        error: error || "Не удалось получить информацию о книге. Проверьте правильность ссылки.",
      },
      { status: 422 }
    );
  }
}

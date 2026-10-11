import { NextRequest, NextResponse } from "next/server";
import { getImageUrl } from "@/lib/goskatalog/client";
import { gkFetch } from "@/lib/goskatalog/transport";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    const original = searchParams.get("original") === "1";
    const download = searchParams.get("download") === "1";
    const filename = searchParams.get("filename") || `exhibit_${id}.jpg`;

    if (!id) {
      return new NextResponse("Missing image id", { status: 400 });
    }

    const url = getImageUrl(id, original ? "original" : 1200);

    const result = await gkFetch(url, {
      budgetMs: 30_000,
      acceptStatus: (s) => s >= 200 && s < 300,
    }).catch((err: unknown) => {
      throw new Error(err instanceof Error ? err.message : String(err));
    });

    if (!result.ok) {
      return new NextResponse(
        "Госкаталог не отдал изображение (возможно, музей скрыл фото или сервер недоступен).",
        { status: 502 }
      );
    }

    const contentType = result.contentType || "image/jpeg";
    const buffer = result.body;
    const encodedName = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        ...(download
          ? { "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}` }
          : {}),
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Госкаталог недоступен: ${error}`, { status: 502 });
  }
}

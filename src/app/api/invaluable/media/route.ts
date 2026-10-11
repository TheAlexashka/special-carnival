import { NextRequest } from "next/server";
import { proxyPublicMedia } from "@/lib/media-proxy";

export const dynamic = "force-dynamic";

/** Прокси фото лотов invaluable (image.invaluable.com) для показа и скачивания. */
export async function GET(req: NextRequest) {
  return proxyPublicMedia(req, {
    defaultReferer: "https://www.invaluable.com/",
    filenamePrefix: "invaluable",
  });
}

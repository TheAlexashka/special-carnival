import { NextRequest } from "next/server";
import { proxyPublicMedia } from "@/lib/media-proxy";

export const dynamic = "force-dynamic";

/** Публичные изображения каталога Royal Collection через общий SSRF-safe прокси. */
export async function GET(req: NextRequest) {
  return proxyPublicMedia(req, {
    defaultReferer: "https://www.rct.uk/",
    filenamePrefix: "royal-collection",
  });
}

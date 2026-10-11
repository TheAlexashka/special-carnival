import { NextRequest } from "next/server";
import { proxyPublicMedia } from "@/lib/media-proxy";

export const dynamic = "force-dynamic";

/**
 * Прокси медиа, на которые ссылается Europeana (edmIsShownBy — оригинал у
 * учреждения-партнёра). Поля с previewNoDistribute=true в интерфейс не попадают.
 */
export async function GET(req: NextRequest) {
  return proxyPublicMedia(req, {
    defaultReferer: "https://www.europeana.eu/",
    filenamePrefix: "europeana-original",
  });
}

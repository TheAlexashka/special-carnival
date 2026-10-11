import { NextRequest } from "next/server";
import { proxyPublicMedia } from "@/lib/media-proxy";

export const dynamic = "force-dynamic";

/** Прокси цифровых копий, на которые ссылается DDB (файлы лежат у учреждений-источников). */
export async function GET(req: NextRequest) {
  return proxyPublicMedia(req, {
    defaultReferer: "https://www.deutsche-digitale-bibliothek.de/",
    filenamePrefix: "ddb-original",
  });
}

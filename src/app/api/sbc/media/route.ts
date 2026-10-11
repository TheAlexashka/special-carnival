import { NextRequest } from "next/server";
import { proxyPublicMedia } from "@/lib/media-proxy";

export const dynamic = "force-dynamic";

/** Обложки/превью из Silesian Digital Library. */
export async function GET(req: NextRequest) {
  return proxyPublicMedia(req, {
    defaultReferer: "https://www.sbc.org.pl/",
    filenamePrefix: "silesian-digital-library",
  });
}

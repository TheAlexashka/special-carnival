import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");
    const referer = searchParams.get("referer") || "https://www.prlib.ru/";

    if (!imageUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const decodedUrl = decodeURIComponent(imageUrl);
    const parsed = new URL(decodedUrl);
    const allowedHosts = [
      "content.prlib.ru",
      "prlib.ru",
      "www.prlib.ru",
      "elib.shpl.ru",
      "shpl.ru",
      "docs.historyrussia.org",
      "historyrussia.org",
      "cdn.gwar.mil.ru",
      "gwar.mil.ru",
      "elibrary.unatlib.ru",
      "kazneb.kz",
      "archive.org",
      "iiif.io",
      "cyberleninka.ru",
      // dokumen.pub (covers live on img.dokumen.pub)
      "dokumen.pub",
      // IIIF image / presentation endpoints
      "digitale-sammlungen.de",
      "api.digitale-sammlungen.de",
      "gallica.bnf.fr",
      "e-codices.unifr.ch",
      "wellcomecollection.org",
      "iiif.wellcomecollection.org",
      "digi.vatlib.it",
      "bodleian.ox.ac.uk",
      "iiif.bodleian.ox.ac.uk",
      "iiif.lib.harvard.edu",
      "iiif.archivelab.org",
      // RosDok — Universität Rostock (IIIF)
      "rosdok.uni-rostock.de",
      "purl.uni-rostock.de",
      // Staatliche Museen zu Berlin — Digitale Sammlungen
      "search.smb.museum",
      "recherche.smb.museum",
      "api.smb.museum",
      // museum-digital regional instances + public assets / source original
      "museum-digital.de",
      "assets.museum-digital.org",
      "bildarchiv.landesmuseum-stuttgart.de",
      // Klassik Stiftung Weimar (IIIF image service)
      "klassik-stiftung.de",
      "ores.klassik-stiftung.de",
      // ONB — Österreichische Nationalbibliothek (IIIF)
      "onb.ac.at",
      // Silesian Digital Library (covers/previews)
      "sbc.org.pl",
      // Royal Collection Trust image CDN
      "col.rct.uk",
    ];

    const isAllowed = allowedHosts.some(
      (host) => parsed.host === host || parsed.host.endsWith(`.${host}`)
    );

    if (!isAllowed) {
      return new NextResponse("Domain not allowed", { status: 403 });
    }

    const res = await fetch(decodedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: referer,
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return new NextResponse(`Failed to fetch image: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Proxy image error:", error);
    return new NextResponse(`Proxy error: ${error}`, { status: 500 });
  }
}

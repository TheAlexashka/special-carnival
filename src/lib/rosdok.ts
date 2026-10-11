import type { BookMetadata } from "./types";
import { parseIiifManifest } from "./iiif";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * RosDok (Universität Rostock / MyCoRe viewer).
 *
 * Проверено на rosdok_document_0000026957:
 * - страница содержит открытый IIIF Presentation v2 manifest;
 * - «PDF Download» ведёт на промежуточную страницу, где лежит настоящий
 *   session-aware href .../recordIdentifier/<id>/<id>.pdf;jsessionid=...;
 * - такой href скачивается без cookie как настоящий PDF (%PDF-).
 */
export async function parseRosdokUrl(rawUrl: string): Promise<BookMetadata> {
  const cleanUrl = rawUrl.split("#")[0].trim();
  const pageResponse = await fetch(cleanUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "de,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });

  if (!pageResponse.ok) {
    throw new Error(`RosDok не отдал карточку документа (HTTP ${pageResponse.status})`);
  }

  const html = await pageResponse.text();
  const finalPageUrl = pageResponse.url || cleanUrl;
  const recordId =
    html.match(/\/do\/pdfdownload\/recordIdentifier\/([^"'?\s]+)/i)?.[1] ||
    html.match(/api\/iiif\/presentation\/v2\/([^/"'?\s]+)\/manifest/i)?.[1];
  const manifestUrl =
    html.match(/href="(https?:\/\/[^"']+\/api\/iiif\/presentation\/v2\/[^"']+\/manifest)"/i)?.[1] ||
    (recordId
      ? `https://rosdok.uni-rostock.de/api/iiif/presentation/v2/${encodeURIComponent(recordId)}/manifest`
      : undefined);

  if (!manifestUrl) {
    throw new Error("В этой карточке RosDok не найден IIIF-манифест страниц.");
  }

  // IIIF endpoint RosDok отвечает именно на application/ld+json (application/json даёт 406).
  const iiif = await parseIiifManifest(manifestUrl, finalPageUrl);

  let directPdfUrl: string | undefined;
  if (recordId) {
    const pdfLanding = `https://rosdok.uni-rostock.de/do/pdfdownload/recordIdentifier/${encodeURIComponent(recordId)}`;
    try {
      const pdfPage = await fetch(pdfLanding, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8", Referer: finalPageUrl },
        signal: AbortSignal.timeout(25000),
      });
      const pdfHtml = await pdfPage.text();
      const pdfHref = pdfHtml.match(
        /href="([^"']*\/do\/pdfdownload\/recordIdentifier\/[^"']+\.pdf(?:;jsessionid=[A-Za-z0-9]+)?)"/i
      )?.[1];
      if (pdfHref) directPdfUrl = new URL(pdfHref.replace(/&amp;/g, "&"), pdfLanding).toString();
    } catch {
      // IIIF fallback still works if the convenience PDF link is temporarily unavailable.
    }
  }

  const rawTitle =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<meta[^>]+name="DC\.title"[^>]+content="([^"]+)"/i)?.[1] ||
    iiif.title;
  const title = decodeHtml(rawTitle) || iiif.title;

  const author = decodeHtml(
    html.match(/contributing persons:[\s\S]{0,500}?<dd[^>]*>([\s\S]*?)<\/dd>/i)?.[1] || ""
  );
  const rights = decodeHtml(
    html.match(/license\/rights statement:[\s\S]{0,600}?<dd[^>]*>([\s\S]*?)<\/dd>/i)?.[1] || ""
  );

  return {
    ...iiif,
    url: finalPageUrl,
    libraryType: "rosdok",
    libraryName: "RosDok — Universität Rostock",
    title,
    author: author || iiif.author,
    description: rights ? `${iiif.description ? `${iiif.description}\n\n` : ""}Права: ${rights}` : iiif.description,
    directPdfUrl,
    metaRaw: {
      ...iiif.metaRaw,
      recordId,
      manifestUrl,
      pdfDownloadUrl: directPdfUrl || null,
      source: "RosDok / Universität Rostock",
    },
  };
}

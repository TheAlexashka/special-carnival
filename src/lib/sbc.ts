import type { BookMetadata, PageInfo } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const SBC = "https://www.sbc.org.pl";

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return null;
}

function fromInitialData(html: string): Record<string, any> {
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return {};
  try {
    return JSON.parse(match[1])?.props?.pageProps?.initialData?.components?.publicationPage || {};
  } catch {
    return {};
  }
}

/**
 * Silesian Digital Library (sbc.org.pl, dLibra): the public publication page
 * includes citation_pdf_url and a direct PDF under /Content/{edition}/PDF/.
 * Tested on the exact user URL: returns a valid 21 MB PDF.
 */
export async function parseSbcUrl(rawUrl: string): Promise<BookMetadata> {
  let page: URL;
  try {
    page = new URL(rawUrl.trim());
  } catch {
    throw new Error("Введите полную ссылку на публикацию sbc.org.pl.");
  }
  if (!/(^|\.)sbc\.org\.pl$/i.test(page.hostname)) {
    throw new Error("Ссылка должна вести на sbc.org.pl.");
  }
  const match = page.pathname.match(/\/dlibra\/publication\/(\d+)\/edition\/(\d+)/i);
  if (!match) throw new Error("Нужна ссылка на издание вида sbc.org.pl/en/dlibra/publication/…/edition/…");

  page.protocol = "https:";
  page.hostname = "www.sbc.org.pl";
  page.search = "";
  page.hash = "";
  const pageUrl = page.toString();
  const res = await fetch(pageUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "en,pl;q=0.8" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Silesian Digital Library ответила HTTP ${res.status}`);
  const html = await res.text();
  const initial = fromInitialData(html);
  const citation = meta(html, "citation_pdf_url");
  const rawPdf = citation || initial.content_url || null;
  if (!rawPdf) throw new Error("На странице SBC не нашёлся прямой PDF этой редакции.");

  const pdfUrl = new URL(String(rawPdf).replace(/\\u0026/g, "&"), pageUrl);
  if (pdfUrl.protocol === "http:") pdfUrl.protocol = "https:";
  const title = meta(html, "citation_title") || meta(html, "og:title") || decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") || `Издание SBC ${match[2]}`;
  const author = meta(html, "citation_author") || meta(html, "DC.creator") || undefined;
  const year = meta(html, "DC.date") || meta(html, "citation_publication_date") || meta(html, "description") || undefined;
  const description = meta(html, "og:description") || undefined;
  const coverUrl = meta(html, "og:image") || undefined;
  const singlePage: PageInfo = {
    index: 1,
    id: match[2],
    label: "Полное издание (PDF)",
    thumbnailUrl: coverUrl || "",
    originalUrl: pdfUrl.toString(),
    hdUrl: pdfUrl.toString(),
    mobileUrl: pdfUrl.toString(),
  };

  return {
    url: pageUrl,
    libraryType: "sbc",
    libraryName: "Silesian Digital Library — Biblioteka Śląska",
    title: title.replace(/\s*-\s*Silesian Digital Library\s*$/i, "").trim(),
    author,
    year,
    description,
    coverUrl,
    totalPages: 1,
    directPdfUrl: pdfUrl.toString(),
    pages: [singlePage],
    metaRaw: { publicationId: match[1], editionId: match[2], pdfUrl: pdfUrl.toString() },
  };
}

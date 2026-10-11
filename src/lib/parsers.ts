import { BookMetadata, PageInfo, SupportedLibraryType } from "./types";
import { parseArchiveUrl, parseCyberleninkaUrl } from "./externals";
import { parseIiifUrl, looksLikeIiif, discoverManifestInHtml, parseIiifManifest } from "./iiif";
import { parseRusnebUrl } from "./rusneb";
import { parseDokumenUrl } from "./dokumen";
import { parseRosdokUrl } from "./rosdok";
import { parseSmbObjectUrl } from "./smb";
import { parseMuseumDigitalUrl } from "./museum-digital";
import { parseKlassikUrl } from "./klassik";
import { parseSbcUrl } from "./sbc";
import { getRctObject } from "./rct";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/Президентская библиотека имени Б\.Н\.\s*Ельцина.*$/i, "")
    .replace(/Электронная библиотека ГПИБ.*$/i, "")
    .replace(/\|\s*Президентская библиотека.*$/i, "")
    .replace(/\|\s*Электронная библиотека.*$/i, "")
    .trim();
}

export function detectLibraryType(rawUrl: string): SupportedLibraryType {
  const url = rawUrl.toLowerCase();
  if (url.includes("prlib.ru")) return "prlib";
  if (url.includes("elib.shpl.ru") || url.includes("shpl.ru")) return "shpl";
  if (url.includes("historyrussia.org")) return "historyrussia";
  if (url.includes("unatlib.ru")) return "unatlib";
  if (url.includes("gwar.mil.ru")) return "gwar";
  if (url.includes("kazneb.kz")) return "kazneb";
  if (url.includes("archive.org")) return "archive";
  if (url.includes("cyberleninka.ru")) return "cyberleninka";
  if (url.includes("dokumen.pub")) return "dokumen";
  // Специализированные источники проверяем ДО общего IIIF-детектора:
  // RosDok включает manifest прямо в карточке, поэтому иначе попадал в iiif.
  if (url.includes("rosdok.uni-rostock.de") || url.includes("purl.uni-rostock.de/rosdok")) return "rosdok";
  if (url.includes("search.smb.museum") || url.includes("sammlung.smb.museum")) return "smb";
  if (url.includes(".museum-digital.de")) return "museumdigital";
  if (url.includes("klassik-stiftung.de")) return "klassik";
  if (url.includes("sbc.org.pl")) return "sbc";
  if (url.includes("rct.uk")) return "rct";
  if (url.includes("rusneb.ru") || url.includes("нэб.рф")) return "rusneb";
  if (looksLikeIiif(url)) return "iiif";
  return "generic";
}

export function getLibraryDisplayName(type: SupportedLibraryType): string {
  switch (type) {
    case "prlib":
      return "Президентская библиотека им. Б.Н. Ельцина";
    case "shpl":
      return "ГПИБ России (Историческая библиотека)";
    case "historyrussia":
      return "Электронная библиотека исторических документов (РИО)";
    case "unatlib":
      return "НЭБ Удмуртской Республики";
    case "gwar":
      return "Портал Первой мировой войны 1914–1918";
    case "kazneb":
      return "КазНЭБ (Казахстанская электронная библиотека)";
    case "archive":
      return "Internet Archive (archive.org)";
    case "cyberleninka":
      return "CyberLeninka — научные статьи";
    case "iiif":
      return "IIIF-библиотека (универсальный формат)";
    case "rusneb":
      return "НЭБ — Национальная электронная библиотека";
    case "dokumen":
      return "Dokumen.pub — открытая библиотека PDF";
    case "rosdok":
      return "RosDok — Universität Rostock";
    case "smb":
      return "Staatliche Museen zu Berlin — Digitale Sammlungen";
    case "museumdigital":
      return "museum-digital";
    case "klassik":
      return "Klassik Stiftung Weimar — Sammlungen Online";
    case "sbc":
      return "Silesian Digital Library — Biblioteka Śląska";
    case "rct":
      return "Royal Collection Trust";
    default:
      return "Электронная библиотека";
  }
}

// 1. PRLIB.RU PARSER
export async function parsePrlibUrl(targetUrl: string): Promise<BookMetadata> {
  // Normalize URL - remove anchor tags like #v=d&...
  const cleanUrl = targetUrl.split("#")[0].trim();
  const urlObj = new URL(cleanUrl);

  const res = await fetch(cleanUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(
      `Не удалось загрузить страницу prlib.ru (HTTP ${res.status}: ${res.statusText})`
    );
  }

  const html = await res.text();

  // Extract Title
  let title = "";
  const titleMatch =
    html.match(/<h1[^>]*id="page-title"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<h1[^>]*class="[^"]*page-header[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);

  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
  }
  if (!title) {
    title = `Документ prlib_${urlObj.pathname.split("/").pop() || "book"}`;
  }
  title = cleanTitle(title);

  // Extract Author and Year if available
  let author: string | undefined;
  const authorMatch = html.match(
    /class="[^"]*field-name-field-doc-author[^"]*"[^>]*>[\s\S]*?<div class="field-item[^"]*">([\s\S]*?)<\/div>/i
  );
  if (authorMatch) {
    author = authorMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  let year: string | undefined;
  const yearMatch =
    html.match(
      /class="[^"]*field-name-field-doc-date[^"]*"[^>]*>[\s\S]*?<div class="field-item[^"]*">([\s\S]*?)<\/div>/i
    ) || html.match(/(\b(1[6-9][0-9]{2}|20[0-2][0-9])\s*г(?:од|.)?\b)/i);
  if (yearMatch) {
    year = yearMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  let description: string | undefined;
  const descMatch = html.match(
    /class="[^"]*field-name-body[^"]*"[^>]*>[\s\S]*?<div class="field-item[^"]*">([\s\S]*?)<\/div>/i
  );
  if (descMatch) {
    description = descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  // Find Drupal.settings with Diva options
  let divaConfig: { objectData?: string; imageDir?: string; iipServerURL?: string } | null = null;
  const scriptSettingsMatch = html.match(/jQuery\.extend\(Drupal\.settings,\s*(\{[\s\S]*?\})\);/);
  if (scriptSettingsMatch) {
    try {
      const settings = JSON.parse(scriptSettingsMatch[1]);
      if (settings.diva) {
        const firstDivaKey = Object.keys(settings.diva)[0];
        if (firstDivaKey && settings.diva[firstDivaKey]?.options) {
          divaConfig = settings.diva[firstDivaKey].options;
        }
      }
    } catch (e) {
      console.warn("Failed to parse Drupal.settings JSON:", e);
    }
  }

  if (!divaConfig || !divaConfig.objectData || !divaConfig.imageDir) {
    // Try regex fallback for objectData and imageDir directly
    const objMatch = html.match(/"objectData"\s*:\s*"([^"]+)"/);
    const imgDirMatch = html.match(/"imageDir"\s*:\s*"([^"]+)"/);
    const iipMatch = html.match(/"iipServerURL"\s*:\s*"([^"]+)"/);
    if (objMatch && imgDirMatch) {
      divaConfig = {
        objectData: objMatch[1].replace(/\\/g, ""),
        imageDir: imgDirMatch[1].replace(/\\/g, ""),
        iipServerURL: iipMatch
          ? iipMatch[1].replace(/\\/g, "")
          : "https://content.prlib.ru/fcgi-bin/iipsrv.fcgi",
      };
    }
  }

  if (!divaConfig || !divaConfig.objectData || !divaConfig.imageDir) {
    throw new Error(
      "Не удалось найти данные страниц в книге prlib.ru. Возможно, страница закрыта для публичного доступа или требует особой авторизации."
    );
  }

  const objectDataUrl = divaConfig.objectData.startsWith("http")
    ? divaConfig.objectData
    : `https://content.prlib.ru${divaConfig.objectData}`;

  const iipServerURL =
    divaConfig.iipServerURL || "https://content.prlib.ru/fcgi-bin/iipsrv.fcgi";
  const imageDir = divaConfig.imageDir;

  // Fetch book metadata JSON (pgs)
  const metaRes = await fetch(objectDataUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: cleanUrl,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!metaRes.ok) {
    throw new Error(`Не удалось загрузить манифест страниц (HTTP ${metaRes.status})`);
  }

  interface PrlibPageItem {
    f: string;
    d?: Array<{ w: number; h: number }>;
    m?: number;
  }
  interface PrlibManifest {
    pgs?: PrlibPageItem[];
    item_title?: string;
  }

  const bookData = (await metaRes.json()) as PrlibManifest;
  const pgs = bookData.pgs || [];

  if (pgs.length === 0) {
    throw new Error("В документе не найдено страниц для скачивания.");
  }

  const pages: PageInfo[] = pgs.map((page, idx) => {
    const pageNum = idx + 1;
    const dims = page.d || [];
    const maxDim = dims.length > 0 ? dims[dims.length - 1] : { w: 2000, h: 3000 };
    const hdDim = dims.length > 2 ? dims[dims.length - 2] : maxDim;
    const mobileDim =
      dims.length > 3 ? dims[dims.length - 3] : dims.length > 1 ? dims[1] : maxDim;
    const thumbDim =
      dims.length > 1 ? dims[1] : dims.length > 0 ? dims[0] : { w: 180, h: 280 };

    const originalUrl = `${iipServerURL}?FIF=${encodeURIComponent(
      imageDir + "/" + page.f
    )}&WID=${maxDim.w}&CVT=jpeg`;
    const hdUrl = `${iipServerURL}?FIF=${encodeURIComponent(
      imageDir + "/" + page.f
    )}&WID=${hdDim.w}&CVT=jpeg`;
    const mobileUrl = `${iipServerURL}?FIF=${encodeURIComponent(
      imageDir + "/" + page.f
    )}&WID=${mobileDim.w}&CVT=jpeg`;
    const thumbnailUrl = `${iipServerURL}?FIF=${encodeURIComponent(
      imageDir + "/" + page.f
    )}&WID=${thumbDim.w}&CVT=jpeg`;

    return {
      index: pageNum,
      id: page.f,
      label: `Страница ${pageNum}`,
      thumbnailUrl,
      originalUrl,
      hdUrl,
      mobileUrl,
      width: maxDim.w,
      height: maxDim.h,
    };
  });

  const coverUrl = pages.length > 0 ? pages[0].thumbnailUrl : undefined;

  return {
    url: cleanUrl,
    libraryType: "prlib",
    libraryName: getLibraryDisplayName("prlib"),
    title,
    author,
    year,
    description,
    coverUrl,
    totalPages: pages.length,
    pages,
    metaRaw: { imageDir, objectDataUrl, iipServerURL },
  };
}

// 2. SHPL.RU & HISTORYRUSSIA.ORG PARSER (docview engine)
export async function parseDocviewUrl(
  targetUrl: string,
  libraryType: "shpl" | "historyrussia"
): Promise<BookMetadata> {
  const cleanUrl = targetUrl.split("#")[0].trim();
  const urlObj = new URL(cleanUrl);
  const domain = urlObj.host;
  const protocol = urlObj.protocol || "http:";

  const res = await fetch(cleanUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(
      `Не удалось загрузить страницу ${domain} (HTTP ${res.status}: ${res.statusText})`
    );
  }

  const html = await res.text();

  // Extract Title
  let title = "";
  const titleMatch =
    html.match(/<h1[^>]*class="[^"]*node-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);

  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
  }
  if (!title) {
    title = `Книга_${urlObj.pathname.split("/").pop() || "shpl"}`;
  }
  title = cleanTitle(title);

  // Extract pages from initDocview script
  interface DocviewPageItem {
    id: number | string;
    n?: number;
    title?: string;
  }
  interface DocviewConfig {
    pages?: DocviewPageItem[];
    quality?: number;
    title?: string;
  }

  let docviewConfig: DocviewConfig | null = null;
  const docviewMatch = html.match(/initDocview\s*\(\s*(\{[\s\S]*?\})\s*\)/);
  if (docviewMatch) {
    try {
      docviewConfig = JSON.parse(docviewMatch[1]);
    } catch {
      // Sometimes keys are unquoted or have trailing commas
      try {
        const relaxed = docviewMatch[1]
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        docviewConfig = JSON.parse(relaxed);
      } catch (err) {
        console.warn("Relaxed JSON parse failed for docview:", err);
      }
    }
  }

  // Fallback regex for pages array if entire initDocview object failed to parse
  if (!docviewConfig || !docviewConfig.pages) {
    const pagesMatch = html.match(/"pages"\s*:\s*(\[[^\]]+\])/);
    if (pagesMatch) {
      try {
        const pagesArr = JSON.parse(pagesMatch[1]);
        docviewConfig = { pages: pagesArr };
      } catch (e) {
        console.warn("Pages regex parse failed:", e);
      }
    }
  }

  if (!docviewConfig || !docviewConfig.pages || docviewConfig.pages.length === 0) {
    throw new Error("Не удалось извлечь список страниц документа с сайта библиотеки.");
  }

  const rawPages = docviewConfig.pages;
  const pages: PageInfo[] = rawPages.map((page, idx) => {
    const pageNum = idx + 1;
    const pageId = page.id;
    const originalUrl = `${protocol}//${domain}/pages/${pageId}/zooms/8`;
    const hdUrl = `${protocol}//${domain}/pages/${pageId}/zooms/6`;
    const mobileUrl = `${protocol}//${domain}/pages/${pageId}/zooms/4`;
    const thumbnailUrl = `${protocol}//${domain}/pages/${pageId}/zooms/2`;

    return {
      index: pageNum,
      id: pageId,
      label: page.title || `Страница ${pageNum}`,
      thumbnailUrl,
      originalUrl,
      hdUrl,
      mobileUrl,
    };
  });

  const coverUrl = pages.length > 0 ? pages[0].thumbnailUrl : undefined;

  return {
    url: cleanUrl,
    libraryType,
    libraryName: getLibraryDisplayName(libraryType),
    title,
    coverUrl,
    totalPages: pages.length,
    pages,
    metaRaw: { domain, total: pages.length },
  };
}

// 3. UNATLIB.RU PARSER (Direct PDF / handle)
export async function parseUnatlibUrl(targetUrl: string): Promise<BookMetadata> {
  const cleanUrl = targetUrl.split("#")[0].trim();
  const res = await fetch(cleanUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Не удалось загрузить страницу elibrary.unatlib.ru (HTTP ${res.status})`);
  }

  const html = await res.text();
  const titleMatch =
    html.match(/<title>([\s\S]*?)<\/title>/i) || html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Книга Удмуртской НЭБ";
  title = cleanTitle(title);

  const pdfMatch =
    html.match(/id="dsview"[^>]*href="([^"]+)"/i) ||
    html.match(/href="(\/bitstream\/handle\/[^"]+\.pdf)"/i);
  if (!pdfMatch) {
    throw new Error("Не удалось найти прямую ссылку на PDF в документе elibrary.unatlib.ru");
  }

  const directPdfUrl = pdfMatch[1].startsWith("http")
    ? pdfMatch[1]
    : `https://elibrary.unatlib.ru${pdfMatch[1]}`;

  return {
    url: cleanUrl,
    libraryType: "unatlib",
    libraryName: getLibraryDisplayName("unatlib"),
    title,
    totalPages: 1,
    directPdfUrl,
    pages: [
      {
        index: 1,
        label: "Полный PDF документ",
        thumbnailUrl: "/images/pdf-cover-placeholder.png",
        originalUrl: directPdfUrl,
        hdUrl: directPdfUrl,
        mobileUrl: directPdfUrl,
      },
    ],
  };
}

// 4. KAZNEB.KZ PARSER
export async function parseKaznebUrl(targetUrl: string): Promise<BookMetadata> {
  const cleanUrl = targetUrl.split("#")[0].trim();
  const res = await fetch(cleanUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Не удалось загрузить страницу kazneb.kz (HTTP ${res.status})`);
  }

  const html = await res.text();
  const titleMatch =
    html.match(/<title>([\s\S]*?)<\/title>/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Книга КазНЭБ";
  title = cleanTitle(title);

  const pageUrls: string[] = [];
  const regex =
    /\/FileStore\/dataFiles\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+\/\d+\/content\/[^\s"'>]+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const pUrl = "https://kazneb.kz" + match[0].replace(/&amp;/g, "&");
    if (!pageUrls.includes(pUrl)) {
      pageUrls.push(pUrl);
    }
  }

  if (pageUrls.length === 0) {
    throw new Error("Не удалось извлечь страницы из книги КазНЭБ.");
  }

  const pages: PageInfo[] = pageUrls.map((pUrl, idx) => ({
    index: idx + 1,
    label: `Страница ${idx + 1}`,
    thumbnailUrl: pUrl,
    originalUrl: pUrl,
    hdUrl: pUrl,
    mobileUrl: pUrl,
  }));

  return {
    url: cleanUrl,
    libraryType: "kazneb",
    libraryName: getLibraryDisplayName("kazneb"),
    title,
    coverUrl: pages[0]?.thumbnailUrl,
    totalPages: pages.length,
    pages,
  };
}

// 5. GWAR.MIL.RU PARSER (First World War)
export async function parseGwarUrl(targetUrl: string): Promise<BookMetadata> {
  const cleanUrl = targetUrl.split("#")[0].trim();
  const res = await fetch(cleanUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Не удалось загрузить страницу gwar.mil.ru (HTTP ${res.status})`);
  }

  const html = await res.text();
  const titleMatch =
    html.match(/<title>([\s\S]*?)<\/title>/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Документ gwar.mil.ru";
  title = cleanTitle(title);

  // Check if direct PDF exists (type 3)
  const pdfMatch = html.match(/data-id="([^"]+)"/);
  if (html.includes("initDetailBook") && pdfMatch) {
    const directPdfUrl = `https://cdn.gwar.mil.ru/bookload/${pdfMatch[1]}.pdf`;
    return {
      url: cleanUrl,
      libraryType: "gwar",
      libraryName: getLibraryDisplayName("gwar"),
      title,
      totalPages: 1,
      directPdfUrl,
      pages: [
        {
          index: 1,
          label: "PDF документ",
          thumbnailUrl: "/images/pdf-cover-placeholder.png",
          originalUrl: directPdfUrl,
          hdUrl: directPdfUrl,
          mobileUrl: directPdfUrl,
        },
      ],
    };
  }

  // Check document images or deals
  const pages: PageInfo[] = [];
  const imgRegex = /https:\/\/cdn\.gwar\.mil\.ru\/(?:imagesfww|imageloadfull)\/[a-zA-Z0-9_\-\/.]+/g;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    const imgUrl = m[0];
    if (!pages.some((p) => p.originalUrl === imgUrl)) {
      const idx = pages.length + 1;
      pages.push({
        index: idx,
        label: `Страница ${idx}`,
        thumbnailUrl: imgUrl,
        originalUrl: imgUrl,
        hdUrl: imgUrl,
        mobileUrl: imgUrl,
      });
    }
  }

  if (pages.length === 0) {
    throw new Error("Не удалось найти изображения документов на gwar.mil.ru.");
  }

  return {
    url: cleanUrl,
    libraryType: "gwar",
    libraryName: getLibraryDisplayName("gwar"),
    title,
    coverUrl: pages[0]?.thumbnailUrl,
    totalPages: pages.length,
    pages,
  };
}

// MAIN UNIFIED PARSER DISPATCHER
export async function parseBookUrl(url: string): Promise<BookMetadata> {
  const libType = detectLibraryType(url);

  switch (libType) {
    case "prlib":
      return await parsePrlibUrl(url);
    case "shpl":
      return await parseDocviewUrl(url, "shpl");
    case "historyrussia":
      return await parseDocviewUrl(url, "historyrussia");
    case "unatlib":
      return await parseUnatlibUrl(url);
    case "gwar":
      return await parseGwarUrl(url);
    case "kazneb":
      return await parseKaznebUrl(url);
    case "archive":
      return await parseArchiveUrl(url);
    case "cyberleninka":
      return await parseCyberleninkaUrl(url);
    case "iiif":
      return await parseIiifUrl(url);
    case "rusneb":
      return await parseRusnebUrl(url);
    case "dokumen":
      return await parseDokumenUrl(url);
    case "rosdok":
      return await parseRosdokUrl(url);
    case "smb":
      return await parseSmbObjectUrl(url);
    case "museumdigital":
      return await parseMuseumDigitalUrl(url);
    case "klassik":
      return await parseKlassikUrl(url);
    case "sbc":
      return await parseSbcUrl(url);
    case "rct": {
      const match = url.match(/\/collection\/(?:RCIN\s*)?(\d{3,})/i) || url.match(/RCIN\s*(\d{3,})/i);
      if (!match) throw new Error("В ссылке Royal Collection не найден номер экспоната RCIN.");
      return await getRctObject(match[1]);
    }
    default: {
      // Unknown site: try the docview engine, then a universal IIIF sniff.
      if (url.includes("nodes")) {
        try {
          return await parseDocviewUrl(url, "shpl");
        } catch (err) {
          const viaIiif = await tryUniversalIiif(url);
          if (viaIiif) return viaIiif;
          throw err;
        }
      }

      // Any page can secretly be a IIIF viewer — sniff before giving up.
      const viaIiif = await tryUniversalIiif(url);
      if (viaIiif) return viaIiif;

      return await parsePrlibUrl(url);
    }
  }
}

/** Best-effort IIIF discovery for sites we have no dedicated parser for. */
async function tryUniversalIiif(url: string): Promise<BookMetadata | null> {
  try {
    const manifestUrl = await discoverManifestInHtml(url);
    if (!manifestUrl) return null;
    return await parseIiifManifest(manifestUrl, url);
  } catch {
    return null;
  }
}

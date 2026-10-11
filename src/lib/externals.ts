import type { BookMetadata } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(raw: string, max: number): string {
  if (raw.length <= max) return raw;
  return raw.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[\\\/:*?"<>|]/g, "_")
    .trim();
}

// ---------------------------------------------------------------------------
// archive.org — Internet Archive (читалка BookReader с кнопкой Download)
// ---------------------------------------------------------------------------

interface ArchiveFileEntry {
  name: string;
  format?: string;
  size?: string;
}

export async function parseArchiveUrl(targetUrl: string): Promise<BookMetadata> {
  const cleanUrl = targetUrl.split("#")[0].trim();
  const idMatch = cleanUrl.match(/archive\.org\/(?:details|stream)\/([A-Za-z0-9._~-]+)/i);
  if (!idMatch) {
    throw new Error(
      "Это не ссылка на книгу archive.org. Нужен вид https://archive.org/details/идентификатор"
    );
  }
  const identifier = idMatch[1];

  const res = await fetch(`https://archive.org/metadata/${identifier}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
    // archive.org lives outside the library allow-list used by the downloader,
    // but this parser only issues parse-time metadata requests.
  });

  if (!res.ok) {
    throw new Error(`archive.org не отдал метаданные (HTTP ${res.status})`);
  }

  const md = (await res.json()) as {
    files?: ArchiveFileEntry[];
    metadata?: Record<string, unknown>;
  };

  if (!md.files || md.files.length === 0) {
    throw new Error("На archive.org не нашлось файлов у этого документа.");
  }

  const isPdfExcluded = (f: ArchiveFileEntry) =>
    /scandata|dtext|additional|_bw|text_pdf_wrap/i.test(f.name);
  const isPdf = (f: ArchiveFileEntry) =>
    /\.pdf$/i.test(f.name) && !/scandata|dtext|additional/i.test(f.name);

  const pdf =
    md.files.find((f) => f.format === "Text PDF" && !isPdfExcluded(f)) ||
    md.files.find((f) => /_text\.pdf$/i.test(f.name)) ||
    md.files.find((f) => /_bw\.pdf$/i.test(f.name)) ||
    md.files.find((f) => f.format === "B/W PDF") ||
    md.files.find(isPdf);

  if (!pdf) {
    throw new Error(
      "У этого документа нет готового PDF в свободном доступе. Возможно, он выдан только «на физном месте» (borrow/fdr)."
    );
  }

  const encodedName = pdf.name.split("/").map(encodeURIComponent).join("/");
  const pdfUrl = `https://archive.org/download/${identifier}/${encodedName}`;

  const meta = md.metadata || {};
  const asText = (v: unknown): string | undefined => {
    if (Array.isArray(v)) return v.filter(Boolean).join("; ");
    if (typeof v === "string") return v;
    return undefined;
  };

  const rawTitle = asText(meta.title) || `Документ archive.org/${identifier}`;
  const title = cleanTitle(rawTitle);
  const author = asText(meta.creator);
  const dateStr = asText(meta.date);
  const year = dateStr?.match(/(1[5-9]\d{2}|20[0-2]\d)/)?.[0];
  const rawDesc = asText(meta.description);
  const description = rawDesc ? truncate(stripHtml(rawDesc), 320) : undefined;

  const coverUrl = `https://archive.org/download/${identifier}/__ia_thumb.jpg`;

  // Try to estimate page count from scandata (best-effort)
  const totalPages = 1;
  const scandata = md.files.find((f) => /_scandata\.xml$/i.test(f.name));

  return {
    url: cleanUrl,
    libraryType: "archive",
    libraryName: "Internet Archive",
    title,
    author: author ? truncate(author, 120) : undefined,
    year,
    publisher: asText(meta.publisher)
      ? truncate(asText(meta.publisher) as string, 120)
      : undefined,
    description,
    coverUrl,
    totalPages,
    directPdfUrl: pdfUrl,
    pages: [
      {
        index: 1,
        label: "Целая книга (PDF)",
        thumbnailUrl: coverUrl,
        originalUrl: pdfUrl,
        hdUrl: pdfUrl,
        mobileUrl: pdfUrl,
      },
    ],
    metaRaw: { identifier, pdfName: pdf.name, scandata: scandata?.name },
  };
}

// ---------------------------------------------------------------------------
// cyberleninka.ru — научная электронная библиотека (PDF прямо в читалке)
// ---------------------------------------------------------------------------

function metaContent(html: string, name: string): string | undefined {
  const re = /<meta[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    if (tag.includes(`name="${name}"`) || tag.includes(`property="${name}"`)) {
      const c = tag.match(/content="([^"]*)"/i);
      if (c) return c[1].trim();
    }
  }
  return undefined;
}

export async function parseCyberleninkaUrl(targetUrl: string): Promise<BookMetadata> {
  const cleanUrl = targetUrl.split("#")[0].split("?")[0].trim();
  if (!/cyberleninka\.ru\/article\/n\//i.test(cleanUrl)) {
    throw new Error(
      "Это не страница статьи CyberLeninka. Нужен вид https://cyberleninka.ru/article/n/название"
    );
  }

  const res = await fetch(cleanUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`CyberLeninka не отдала страницу (HTTP ${res.status})`);
  }

  const html = await res.text();

  let pdfUrl = metaContent(html, "citation_pdf_url");
  if (!pdfUrl) {
    throw new Error(
      "У этой статьи не нашлось PDF (возможно, это только аннотация). Проверьте кнопку «Читать/Download» на CyberLeninka."
    );
  }
  if (pdfUrl.startsWith("/")) {
    pdfUrl = `https://cyberleninka.ru${pdfUrl}`;
  }

  const rawTitle =
    metaContent(html, "citation_title") ||
    metaContent(html, "og:title") ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    "Статья CyberLeninka";

  const title = cleanTitle(stripHtml(rawTitle));
  let author: string | undefined;
  const authorRe = /<meta[^>]*name="citation_author"[^>]*content="([^"]*)"[^>]*>/gi;
  const authors: string[] = [];
  let am: RegExpExecArray | null;
  while ((am = authorRe.exec(html)) !== null && authors.length < 4) {
    authors.push(am[1].trim());
  }
  if (authors.length) {
    author = authors.join(", ") + (authors.length >= 4 ? " и др." : "");
  }

  const dateStr = metaContent(html, "citation_publication_date");
  const year = dateStr?.match(/(19|20)\d{2}/)?.[0];

  const abstract = metaContent(html, "citation_abstract") || metaContent(html, "og:description");
  const description = abstract ? truncate(stripHtml(abstract), 320) : undefined;

  // Page range, e.g. "54-63"
  let totalPages = 1;
  const pagesStr = metaContent(html, "citation_pages");
  if (pagesStr) {
    const pm = pagesStr.match(/(\d+)\s*[-—–]\s*(\d+)/);
    if (pm) {
      totalPages = Math.max(1, parseInt(pm[2], 10) - parseInt(pm[1], 10) + 1);
    }
  }

  const coverUrl = metaContent(html, "og:image");

  return {
    url: cleanUrl,
    libraryType: "cyberleninka",
    libraryName: "CyberLeninka — научные статьи",
    title,
    author,
    year,
    publisher: metaContent(html, "citation_journal_title"),
    description,
    coverUrl,
    totalPages,
    directPdfUrl: pdfUrl,
    pages: [
      {
        index: 1,
        label: "Статья целиком (PDF)",
        thumbnailUrl: coverUrl || "",
        originalUrl: pdfUrl,
        hdUrl: pdfUrl,
        mobileUrl: pdfUrl,
      },
    ],
  };
}

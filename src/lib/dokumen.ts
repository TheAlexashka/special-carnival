import type { BookMetadata, PageInfo } from "./types";

/**
 * dokumen.pub — открытая библиотека документов.
 *
 * Кнопка «DOWNLOAD FILE» и встроенный pdfViewer ссылаются на один и тот же
 * адрес: https://dokumen.pub/download/<slug>.html?reader=1
 * Без сессии сайт отвечает 302 на страницу книги, поэтому перед скачиванием
 * нужно «прогреть» cookie-сессию обычным запросом страницы и повторить запрос
 * файла с браузерными заголовками (Referer + Sec-Fetch).
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HOST_RE = /(^|\.)dokumen\.pub$/i;

export function isDokumenUrl(rawUrl: string): boolean {
  try {
    return HOST_RE.test(new URL(rawUrl.trim()).hostname);
  } catch {
    return false;
  }
}

/** Приводит /download/slug.html к обычной странице книги. */
export function normalizeDokumenPageUrl(rawUrl: string): string {
  const url = new URL(rawUrl.split("#")[0].trim());
  url.pathname = url.pathname.replace(/^\/download\//i, "/");
  return url.toString();
}

function buildDownloadUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  const slug = url.pathname.replace(/^\/+/i, "").replace(/\.html?$/i, "");
  return `https://dokumen.pub/download/${slug}.html?reader=1`;
}

/**
 * Настоящий адрес файла берём из параметра file= встроенного pdfViewer —
 * пересобранная по шаблону ссылка есть не у всех книг (проверено вживую):
 * у части изданий /download/<slug>.html отвечает 302/404, а viewer указывает
 * либо на реальный файл, либо на заглушку assets/pdf/min.pdf.
 */
function extractViewerFileUrl(html: string, pageUrl: string): string | null {
  const match = html.match(/viewer\.html\?file=([^"'&\s]+)/i);
  if (!match?.[1]) return null;
  try {
    const decoded = decodeURIComponent(match[1]).split("#")[0].trim();
    return decoded ? new URL(decoded, pageUrl).toString() : null;
  } catch {
    return null;
  }
}

/** Кнопка DOWNLOAD FILE — отдельный путь, не всегда совпадает с viewer file=. */
function extractDownloadButtonUrl(html: string, pageUrl: string): string | null {
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [];
  for (const anchor of anchors) {
    if (!/DOWNLOAD\s+FILE/i.test(anchor.replace(/<[^>]+>/g, " "))) continue;
    const href = anchor.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      return new URL(href, pageUrl).toString();
    } catch {
      // try next anchor
    }
  }
  return null;
}

/** min.pdf — заглушка viewer'а, но НЕ доказательство отсутствия отдельной кнопки скачивания. */
function isPlaceholderFile(fileUrl: string): boolean {
  return /\/assets\/pdf\/min\.pdf/i.test(fileUrl);
}

/**
 * Viewer URL, download button и реальная доступность файла — три разных вещи.
 * `hasFile: null` означает «нужно проверить queue/download flow», а не «книгу удалили».
 */
export function resolveDokumenFile(
  html: string,
  pageUrl: string
): { fileUrl: string; hasFile: boolean | null; viewerFileUrl: string | null; downloadButtonUrl: string | null } {
  const viewerFileUrl = extractViewerFileUrl(html, pageUrl);
  const downloadButtonUrl = extractDownloadButtonUrl(html, pageUrl);

  if (viewerFileUrl && !isPlaceholderFile(viewerFileUrl)) {
    return { fileUrl: viewerFileUrl, hasFile: true, viewerFileUrl, downloadButtonUrl };
  }

  // min.pdf может быть лишь превью-заглушкой: пробуем настоящий DOWNLOAD FILE.
  // Статус оставляем unknown до проверки queue/cdownload.
  const fileUrl = downloadButtonUrl || (viewerFileUrl && !isPlaceholderFile(viewerFileUrl) ? viewerFileUrl : buildDownloadUrl(pageUrl));
  return { fileUrl, hasFile: null, viewerFileUrl, downloadButtonUrl };
}

function readSetCookies(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(existing: Map<string, string>, raw: string[]) {
  for (const line of raw) {
    const [pair] = line.split(";");
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    existing.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

/** Открывает страницу книги и собирает cookie-сессию (1–2 редиректа). */
async function primeDokumenSession(pageUrl: string, jar: Map<string, string>): Promise<void> {
  let current = pageUrl;
  for (let hop = 0; hop < 3; hop += 1) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    mergeCookies(jar, readSetCookies(res));

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    // Тело не нужно — только сессия.
    try {
      await res.arrayBuffer();
    } catch {
      // ignore
    }
    return;
  }
}

function firstEmValues(html: string): string[] {
  const out: string[] = [];
  const re = /<em>([^<]{1,80})<\/em>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html) as RegExpExecArray | null) !== null) out.push(m[1].trim());
  return out;
}

function decodeEntitiesOnce(value: string): string {
  return value.replace(
    /&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi,
    (_match, code: string) => {
      const normalized = code.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      if (normalized === "quot") return '"';
      if (normalized === "apos" || normalized === "nbsp") return " ";
      if (normalized.startsWith("#x")) {
        const cp = parseInt(normalized.slice(2), 16);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : " ";
      }
      const cp = parseInt(normalized.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : " ";
    }
  );
}

/**
 * На dokumen.pub metа-теги закодированы дважды (в HTML лежит `&amp;nbsp;`),
 * поэтому декодируем до стабильного результата, но не больше трёх проходов.
 */
function decodeEntities(value: string): string {
  let out = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeEntitiesOnce(out);
    if (next === out) break;
    out = next;
  }
  return out.replace(/\s+/g, " ").trim();
}

function metaTag(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  return html.match(re)?.[1]?.trim();
}

const LANGUAGES = [
  "english",
  "russian",
  "german",
  "french",
  "spanish",
  "italian",
  "portuguese",
  "turkish",
  "polish",
  "ukrainian",
  "dutch",
  "czech",
];

export async function parseDokumenUrl(rawUrl: string): Promise<BookMetadata> {
  const pageUrl = normalizeDokumenPageUrl(rawUrl);
  const downloadUrl = buildDownloadUrl(pageUrl);

  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    throw new Error(`dokumen.pub не отдал страницу книги (HTTP ${res.status})`);
  }

  const html = await res.text();
  const slug = new URL(pageUrl).pathname.replace(/^\/+/i, "").replace(/\.html?$/i, "");

  const ogTitle =
    metaTag(html, "og:title") || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || slug;
  const title = decodeEntities(
    ogTitle
      .replace(/<[^>]+>/g, " ")
      .replace(/\s*[-–|]\s*DOKUMEN\.PUB\s*$/i, "")
      .replace(/DOKUMEN\.PUB/gi, "")
      .replace(/[\\/:*?"<>|]/g, "_")
  ).slice(0, 180);

  const coverUrl = metaTag(html, "og:image") || undefined;
  const rawDescription =
    metaTag(html, "og:description") || metaTag(html, "description") || undefined;
  const description =
    rawDescription && !/^\.{3}$/.test(rawDescription) && rawDescription.length > 12
      ? decodeEntities(rawDescription.replace(/<[^>]+>/g, " ")).slice(0, 320)
      : undefined;

  const values = firstEmValues(html);
  let totalPages = 1;
  let year: string | undefined;
  let language: string | undefined;
  let sizeLabel: string | undefined;

  for (const value of values) {
    const pagesMatch = value.match(/^Pages?\s*[: ]\s*(\d+)/i);
    if (pagesMatch) {
      totalPages = Math.max(1, parseInt(pagesMatch[1], 10));
      continue;
    }
    const yearMatch = value.match(/^Year\s*[: ]\s*((?:19|20)\d{2})/i);
    if (yearMatch) {
      year = yearMatch[1];
      continue;
    }
    const sizeMatch = value.match(/^([\d.,]+)\s*(KB|MB|GB)$/i);
    if (sizeMatch) {
      sizeLabel = value;
      continue;
    }
    const bareYear = value.match(/^(19|20)\d{2}$/);
    if (bareYear && !year) year = value;
    if (LANGUAGES.includes(value.toLowerCase()) && !language) language = value;
  }

  const rawAuthor = metaTag(html, "citation_author");
  const author = rawAuthor ? decodeEntities(rawAuthor).slice(0, 160) : undefined;

  // Не делаем вывод «файла нет» только по min.pdf: у книги может быть отдельная
  // кнопка DOWNLOAD FILE с queue/cdownload-потоком, как у пользователя в браузере.
  const fileResolution = resolveDokumenFile(html, pageUrl);
  const finalFileUrl = fileResolution.fileUrl || downloadUrl;

  const page: PageInfo = {
    index: 1,
    id: slug,
    label: "Книга целиком (PDF)",
    thumbnailUrl: coverUrl || "",
    originalUrl: finalFileUrl,
    hdUrl: finalFileUrl,
    mobileUrl: finalFileUrl,
  };

  return {
    url: pageUrl,
    libraryType: "dokumen",
    libraryName: "Dokumen.pub — открытая библиотека PDF",
    title: title || slug,
    author: author || undefined,
    year,
    description,
    coverUrl,
    totalPages,
    directPdfUrl: finalFileUrl,
    pages: [page],
    metaRaw: {
      slug,
      downloadUrl,
      viewerFileUrl: fileResolution.viewerFileUrl,
      downloadButtonUrl: fileResolution.downloadButtonUrl,
      fileAvailability: fileResolution.hasFile === true ? "direct" : "queue-or-unknown",
      sizeLabel,
      language,
    },
  };
}

/**
 * Скачивает файл dokumen.pub: сначала «прогревает» cookie-сессию на странице
 * книги, затем запрашивает PDF как это делает встроенный pdfViewer.
 */
function extractCdownloadUrl(queueHtml: string, pageUrl: string): string | null {
  const candidates = [...queueHtml.matchAll(/fileurl=([^&"'\s]+)/gi)];
  for (const match of candidates) {
    try {
      const candidate = decodeURIComponent(match[1]);
      const parsed = new URL(candidate, pageUrl);
      if (HOST_RE.test(parsed.hostname) && /\/cdownload\//i.test(parsed.pathname)) {
        return parsed.toString();
      }
    } catch {
      // try next link
    }
  }
  return null;
}

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

async function requestDokumenResource(
  url: string,
  pageUrl: string,
  jar: Map<string, string>,
  timeoutMs = 25000
): Promise<{ status: number; finalUrl: string; type: string; body: Buffer }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/pdf,text/html,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: pageUrl,
      "Sec-Fetch-Dest": "iframe",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  mergeCookies(jar, readSetCookies(res));
  return {
    status: res.status,
    finalUrl: res.url || url,
    type: res.headers.get("content-type") || "",
    body: Buffer.from(await res.arrayBuffer()),
  };
}

/**
 * Скачивание поддерживает оба механизма dokumen.pub:
 *  1. pdfViewer file=…&reader=1 — быстрый прямой PDF;
 *  2. кнопка DOWNLOAD FILE → /download/… → /qdownload/… → /cdownload/… —
 *     очередь сайта (с таймером до 120 секунд). Viewer и download-кнопка —
 *     независимые пути: служебный min.pdf в просмотрщике НЕ доказывает, что
 *     файл нельзя получить через отдельную кнопку загрузки.
 *
 * Важно: min.pdf в viewer'е не равен «книга удалена». Это лишь заглушка
 * предварительного просмотра; поэтому пробуем очередь загрузки и только потом
 * сообщаем, что нашему серверу не удалось получить файл.
 */
export async function fetchDokumenPdf(
  fileUrl: string,
  pageUrl: string,
  retries = 0
): Promise<Buffer> {
  let lastError: Error | null = null;
  const page = normalizeDokumenPageUrl(pageUrl);
  const slug = new URL(page).pathname.replace(/^\/+/, "").replace(/\.html?$/i, "");
  const readerUrl = buildDownloadUrl(page);
  const plainDownloadUrl = `https://dokumen.pub/download/${slug}.html`;
  const queueUrl = `https://dokumen.pub/qdownload/${slug}.html`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const jar = new Map<string, string>();
    try {
      await primeDokumenSession(page, jar);

      // 1) Самый быстрый путь — адрес PDF, который отдаёт встроенный viewer.
      const directCandidates = [...new Set([fileUrl, readerUrl])].filter(
        (candidate) => candidate && !isPlaceholderFile(candidate)
      );
      for (const candidate of directCandidates) {
        try {
          const resource = await requestDokumenResource(candidate, page, jar, 35000);
          if (resource.status === 404) {
            lastError = new Error("Прямая ссылка на PDF вернула 404; пробую кнопку DOWNLOAD FILE.");
            continue;
          }
          if (resource.status >= 200 && resource.status < 300 && isPdf(resource.body)) {
            return resource.body;
          }
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      // 2) Кнопка DOWNLOAD FILE: обычный адрес ведёт через 302 на qdownload.
      let queueHtml = "";
      for (const candidate of [fileUrl, plainDownloadUrl, queueUrl]) {
        try {
          const resource = await requestDokumenResource(candidate, page, jar, 30000);
          if (resource.status >= 200 && resource.status < 300 && isPdf(resource.body)) {
            return resource.body;
          }
          const bodyText = resource.body.toString("utf8");
          if (/qdownload/i.test(resource.finalUrl) || /Queue\s*\|/i.test(bodyText) || /DOWNLOAD PDF/i.test(bodyText)) {
            queueHtml = bodyText;
            break;
          }
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      // 3) Одна быстрая проверка cdownload — вдруг файл уже доступен без очереди.
      //
      // Долгие ретраи здесь бессмысленны, проверено вживую полным проходом
      // очереди в одной cookie-сессии: сервер честно досчитывает 120 секунд
      // (видели 120 → 89 → 14 → «Ready»), но затем страница требует Google
      // reCAPTCHA «I'm not a robot», и POST без её ответа отклоняется (302
      // обратно в очередь). Пройти капчу может только человек в браузере —
      // автоматизировать это нельзя и не нужно.
      const cdownloadUrl =
        (queueHtml && extractCdownloadUrl(queueHtml, page)) ||
        `https://dokumen.pub/cdownload/${slug}.html`;
      try {
        const download = await requestDokumenResource(cdownloadUrl, page, jar, 20000);
        if (download.status >= 200 && download.status < 300 && isPdf(download.body)) {
          return download.body;
        }
        lastError = new Error("файл выдаётся только после очереди с проверкой «я не робот»");
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(
    `Эта книга отдаётся dokumen.pub только через очередь со встроенной проверкой «я не робот» (Google reCAPTCHA) — сервер пройти её не может, это по силам только человеку. ` +
      `Нажмите «Открыть источник», на странице книги нажмите DOWNLOAD FILE, подождите таймер (~2 минуты), отметьте «I'm not a robot» — и файл скачается прямо в ваш браузер. ` +
      `Техническая деталь: ${lastError?.message || "очередь не выдала файл"}`
  );
}

/**
 * Быстрая проверка прямого PDF: GET Range 0–4, читаем только первый чанк.
 * true = получили `%PDF-`; false = достоверный HTTP 404; null = очередь,
 * временная ошибка, HTML или другой случай, который не доказывает отсутствие файла.
 */
export async function verifyDokumenFile(fileUrl: string, pageUrl: string): Promise<boolean | null> {
  const jar = new Map<string, string>();
  try {
    await primeDokumenSession(pageUrl, jar);
    const res = await fetch(fileUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/pdf,*/*;q=0.8",
        Referer: "https://dokumen.pub/pdfviewer/web/viewer.html",
        "Sec-Fetch-Dest": "iframe",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        Range: "bytes=0-4",
        ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 404) return false;
    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    try {
      const first = await reader.read();
      const head = first.value ? Buffer.from(first.value).subarray(0, 5).toString("latin1") : "";
      return head === "%PDF-" ? true : null;
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  } catch {
    return null;
  }
}

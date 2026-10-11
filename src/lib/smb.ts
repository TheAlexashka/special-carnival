import type { BookMetadata, PageInfo } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const SMB_HOST = "https://search.smb.museum";

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

function normalizeSmbUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.hostname === "sammlung.smb.museum") url.hostname = "search.smb.museum";
  if (!url.pathname.startsWith("/en/object/") && !url.pathname.startsWith("/object/")) {
    const id = url.pathname.match(/obj-\d+/i)?.[0];
    if (id) url.pathname = `/en/object/${id}`;
  }
  return url.toString();
}

/**
 * Карточка объекта Staatliche Museen zu Berlin / Digitale Sammlungen.
 *
 * Портал SSR-рендерит метаданные и публичные изображения:
 * /media/images/originals/<путь>/<файл>.JPG — настоящий high-res JPEG.
 * Это даёт возможность собрать один объект (одно или несколько фото) в PDF
 * или ZIP без закрытого API и без российского IP.
 */
export async function parseSmbObjectUrl(rawUrl: string): Promise<BookMetadata> {
  const sourceUrl = normalizeSmbUrl(rawUrl.split("#")[0].trim());
  const objectMatch = sourceUrl.match(/\/object\/(obj-\d+)/i);
  if (!objectMatch) {
    throw new Error(
      "Для скачивания SMB вставьте ссылку именно на объект вида https://search.smb.museum/en/object/obj-123456."
    );
  }

  const res = await fetch(sourceUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "en,de;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`SMB не отдал карточку объекта (HTTP ${res.status})`);

  const html = await res.text();
  const finalUrl = res.url || sourceUrl;
  const objectId = objectMatch[1];
  const title = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || objectId);

  // Берём только оригиналы, не похожие картинки «другие объекты» внизу страницы.
  const originals = [...html.matchAll(/href="(\/media\/images\/originals\/[^"']+)"/gi)]
    .map((match) => new URL(match[1].replace(/&amp;/g, "&"), SMB_HOST).toString())
    .filter((url, index, all) => all.indexOf(url) === index);

  if (!originals.length) {
    throw new Error(
      "В этой карточке SMB не найдено открытых оригиналов изображения. Возможно, музей не опубликовал фото или ограничил его лицензию."
    );
  }

  const thumb = html.match(/src="(\/media\/images\/thumbs\/extra_large\/[^"']+)"/i)?.[1];
  const objectNo = decodeHtml(html.match(/(?:Id\. Nr\.|Inventarnummer):<\/span>\s*([^<]+)/i)?.[1] || "");
  const credit = decodeHtml(html.match(/Credit:\s*([\s\S]{0,500}?)<\/div>/i)?.[1] || "");
  const description = credit ? `Изображение: ${credit}` : undefined;

  const pages: PageInfo[] = originals.map((url, index) => ({
    index: index + 1,
    id: `${objectId}-${index + 1}`,
    label: originals.length === 1 ? "Оригинальное изображение" : `Изображение ${index + 1}`,
    thumbnailUrl: index === 0 && thumb ? new URL(thumb, SMB_HOST).toString() : url,
    originalUrl: url,
    hdUrl: url,
    mobileUrl: url,
  }));

  return {
    url: finalUrl,
    libraryType: "smb",
    libraryName: "Staatliche Museen zu Berlin — Digitale Sammlungen",
    title,
    author: credit || undefined,
    description,
    coverUrl: pages[0]?.thumbnailUrl,
    totalPages: pages.length,
    pages,
    metaRaw: {
      objectId,
      objectNumber: objectNo || null,
      credit: credit || null,
      canonical: `https://search.smb.museum/en/object/${objectId}`,
      source: "Staatliche Museen zu Berlin",
    },
  };
}

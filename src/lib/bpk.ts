/**
 * bpk-Fotoarchiv (Staatsbibliothek zu Berlin).
 *
 * bpk закрывает основной поиск (recherche.bpk-fotoarchiv.de / picturemaxx)
 * от серверных запросов, но публично отдаёт:
 *  - страницы фотовладельцев (`/pages/<slug>`, `/fotografinnen-archiv/...`)
 *    со списком работ;
 *  - медиа-API `/bs/api/assets:media:<id>:view:preview?nl` — preview С
 *    водяным знаком (публично, согласно AGB: Thumbnails/Previews sind
 *    gebührenfrei online zugänglich) и `view:thumbnail` для мелких превью.
 *
 * Поэтому в приложении показываем превью с вотермарком (это разрешено), а
 * high-res не скачиваем — по AGB это требует разрешения/регистрации.
 */

const SITE = "https://bpk-fotoarchiv.de";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

/** Полный набор заголовков: bpk отдаёт 403 без Accept-Encoding: identity и Sec-Fetch. */
function headers(kind: "html" | "json" | "image", referer: string): Record<string, string> {
  const base: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "identity",
  };
  if (kind === "html") {
    return {
      ...base,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Upgrade-Insecure-Requests": "1",
      Referer: referer,
    };
  }
  if (kind === "json") {
    return {
      ...base,
      Accept: "application/json, text/plain, */*",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      Referer: referer,
    };
  }
  return {
    ...base,
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "same-origin",
    Referer: referer,
  };
}

export interface BpkPhoto {
  id: string;
  /** Инвентарный номер / подпись, если она есть в разметке. */
  caption: string | null;
  thumbnailUrl: string;
  previewUrl: string;
  /** Ссылка на страницу-источник (портфель фотовладельца). */
  sourcePageUrl: string;
  credit: string;
}

export interface BpkCollection {
  slug: string;
  title: string;
  url: string;
}

/** Список портфелей фотовладельцев (публичный каталог раздела). */
export async function listBpkCollections(): Promise<BpkCollection[]> {
  const pages = [
    "/fotografinnen-archiv/vor-und-nachlaesse",
    "/fotografinnen-archiv/fotografinnen",
    "/fotografinnen-archiv/neuzugaenge",
  ];

  const found = new Map<string, BpkCollection>();

  for (const path of pages) {
    const res = await fetch(`${SITE}${path}`, { headers: headers("html", SITE) });
    if (!res.ok) continue;
    const html = await res.text();

    const re = /<a href="\/pages\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const slug = match[1];
      if (found.has(slug)) continue;
      const title = decodeHtml(match[2]) || slug;
      found.set(slug, { slug, title, url: `${SITE}/pages/${slug}` });
    }
  }

  return [...found.values()];
}

/** Фотографии конкретного портфеля: превью с вотермарком + thumbnails. */
export async function getBpkPhotos(collectionSlug: string, pageUrl?: string): Promise<{
  collection: BpkCollection;
  photos: BpkPhoto[];
  sourcePageUrl: string;
}> {
  const url = pageUrl || `${SITE}/pages/${collectionSlug}`;
  const res = await fetch(url, { headers: headers("html", SITE) });
  if (!res.ok) throw new Error(`bpk не отдал страницу (HTTP ${res.status})`);
  const html = await res.text();

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = decodeHtml(titleMatch?.[1] || collectionSlug).replace(/\s*\|\s*bpk.*$/i, "");
  const credit = decodeHtml(html.match(/bpk\s*\/\s*([^<"]{3,120})/i)?.[1] || "bpk / Staatsbibliothek zu Berlin");

  const photos: BpkPhoto[] = [];
  const seen = new Set<string>();

  // Разметка: <div ... class="b-lazy" data-src="/bs/api/assets:media:<id>:view:preview?nl" ...>
  const previewRe = /data-src="(\/bs\/api\/assets:media:(\d+):view:preview\?nl)"/gi;
  let match: RegExpExecArray | null;
  while ((match = previewRe.exec(html)) !== null) {
    const id = match[2];
    if (seen.has(id)) continue;
    seen.add(id);
    photos.push({
      id,
      caption: null,
      thumbnailUrl: `${SITE}/bs/api/assets:media:${id}:view:thumbnail?nl`,
      previewUrl: `${SITE}${match[1]}`,
      sourcePageUrl: url,
      credit,
    });
  }

  // Инвентарные номера: alt-подписи рядом с превью (best-effort).
  const altRe = /assets:media:(\d+):view:preview\?nl"[^>]*alt="([^"]*)"/gi;
  while ((match = altRe.exec(html)) !== null) {
    const photo = photos.find((p) => p.id === match![1]);
    if (photo) photo.caption = decodeHtml(match[2]) || null;
  }

  if (!photos.length) throw new Error("В этом портфеле нет опубликованных превью.");

  return { collection: { slug: collectionSlug, title, url }, photos, sourcePageUrl: url };
}

/** Прокси-адрес превью с вотермарком — для показа и скачивания в приложении. */
export function bpkProxyUrl(photo: BpkPhoto, kind: "thumb" | "preview"): string {
  const raw = kind === "preview" ? photo.previewUrl : photo.thumbnailUrl;
  return `/api/bpk/image?url=${encodeURIComponent(raw)}`;
}
